resource "aws_security_group" "bastion" {
  name        = "${var.project_name}-bastion"
  description = "Certificate-only event SSH jump host"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-bastion"
  }
}

resource "aws_vpc_security_group_ingress_rule" "bastion_ssh" {
  for_each = toset(local.allowed_source_cidrs)

  security_group_id = aws_security_group.bastion.id
  description       = "DEMO certificate SSH from an explicitly approved source"
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
  cidr_ipv4         = each.value
}

resource "aws_vpc_security_group_egress_rule" "bastion_to_vault" {
  security_group_id            = aws_security_group.bastion.id
  description                  = "SSH jump to the private Vault host only"
  ip_protocol                  = "tcp"
  from_port                    = 22
  to_port                      = 22
  referenced_security_group_id = aws_security_group.vault.id
}

resource "aws_vpc_security_group_egress_rule" "bastion_https" {
  security_group_id = aws_security_group.bastion.id
  description       = "SSM and operating system security services"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "bastion_dns_udp" {
  security_group_id = aws_security_group.bastion.id
  description       = "VPC DNS"
  ip_protocol       = "udp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = data.aws_vpc.selected.cidr_block
}

resource "aws_vpc_security_group_egress_rule" "bastion_dns_tcp" {
  security_group_id = aws_security_group.bastion.id
  description       = "VPC DNS fallback"
  ip_protocol       = "tcp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = data.aws_vpc.selected.cidr_block
}

resource "aws_vpc_security_group_egress_rule" "bastion_ntp" {
  security_group_id = aws_security_group.bastion.id
  description       = "Amazon Time Sync Service"
  ip_protocol       = "udp"
  from_port         = 123
  to_port           = 123
  cidr_ipv4         = "169.254.169.123/32"
}

resource "aws_vpc_security_group_ingress_rule" "vault_ssh_from_bastion" {
  security_group_id            = aws_security_group.vault.id
  description                  = "Certificate-only event SSH from the bastion"
  ip_protocol                  = "tcp"
  from_port                    = 22
  to_port                      = 22
  referenced_security_group_id = aws_security_group.bastion.id
}

resource "aws_iam_role" "bastion" {
  name = "${var.project_name}-bastion"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "bastion_ssm" {
  role       = aws_iam_role.bastion.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "bastion" {
  name = "${var.project_name}-bastion"
  role = aws_iam_role.bastion.name
}

resource "aws_instance" "bastion" {
  ami                         = data.aws_ami.vault.id
  instance_type               = "t3.micro"
  subnet_id                   = var.public_subnet_ids[0]
  vpc_security_group_ids      = [aws_security_group.bastion.id]
  iam_instance_profile        = aws_iam_instance_profile.bastion.name
  associate_public_ip_address = true
  user_data_replace_on_change = false

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "disabled"
  }

  root_block_device {
    encrypted             = true
    kms_key_id            = aws_kms_key.storage.arn
    volume_type           = "gp3"
    volume_size           = 16
    delete_on_termination = true
  }

  user_data = templatefile("${path.module}/templates/bastion-user-data.sh.tftpl", {
    event_ssh_users           = var.event_ssh_users
    event_ssh_expires_at      = var.event_ssh_expires_at
    event_ssh_expiry_calendar = var.event_ssh_expiry_calendar
    vault_private_dns_name    = "vault.${var.project_name}.internal"
  })

  tags = {
    Name      = "${var.project_name}-bastion"
    Access    = "certificate-only"
    ExpiresAt = var.event_access_expires_at
  }

  lifecycle {
    precondition {
      condition     = data.aws_ami.vault.architecture == "x86_64"
      error_message = "The bastion requires the approved x86_64 hardened AMI."
    }
  }

  depends_on = [aws_iam_role_policy_attachment.bastion_ssm]
}

resource "aws_eip" "bastion" {
  domain   = "vpc"
  instance = aws_instance.bastion.id

  tags = {
    Name = "${var.project_name}-bastion"
  }
}

resource "aws_route53_record" "bastion" {
  zone_id = var.hosted_zone_id
  name    = "bob-vault-bastion.${var.public_zone_name}"
  type    = "A"
  ttl     = 60
  records = [aws_eip.bastion.public_ip]
}

resource "aws_ssm_document" "configure_bastion_event_ssh" {
  name            = "${var.project_name}-configure-bastion-event-ssh"
  document_type   = "Command"
  document_format = "JSON"

  content = jsonencode({
    schemaVersion = "2.2"
    description   = "Configure time-bounded per-person SSH public keys on the event bastion"
    mainSteps = [{
      action = "aws:runShellScript"
      name   = "configureEventSsh"
      inputs = {
        timeoutSeconds = "300"
        runCommand = [templatefile("${path.module}/templates/bastion-user-data.sh.tftpl", {
          event_ssh_users           = var.event_ssh_users
          event_ssh_expires_at      = var.event_ssh_expires_at
          event_ssh_expiry_calendar = var.event_ssh_expiry_calendar
          vault_private_dns_name    = "vault.${var.project_name}.internal"
        })]
      }
    }]
  })

  tags = {
    Name = "${var.project_name}-configure-bastion-event-ssh"
  }
}

resource "aws_ssm_association" "bastion_event_ssh" {
  name             = aws_ssm_document.configure_bastion_event_ssh.name
  association_name = "${var.project_name}-bastion-event-ssh"

  targets {
    key    = "InstanceIds"
    values = [aws_instance.bastion.id]
  }

  wait_for_success_timeout_seconds = 600
}

resource "aws_ssm_document" "configure_vault_event_ssh" {
  name            = "${var.project_name}-configure-event-ssh"
  document_type   = "Command"
  document_format = "JSON"

  content = jsonencode({
    schemaVersion = "2.2"
    description   = "Install per-person SSH public keys on the private Vault host"
    mainSteps = [{
      action = "aws:runShellScript"
      name   = "configurePublicKey"
      inputs = {
        timeoutSeconds = "300"
        runCommand = [templatefile("${path.module}/templates/configure-vault-event-ssh.sh.tftpl", {
          event_ssh_users = var.event_ssh_users
        })]
      }
    }]
  })

  tags = {
    Name = "${var.project_name}-configure-event-ssh"
  }
}

resource "aws_ssm_association" "vault_event_ssh" {
  name             = aws_ssm_document.configure_vault_event_ssh.name
  association_name = "${var.project_name}-vault-event-ssh"

  targets {
    key    = "InstanceIds"
    values = [aws_instance.vault.id]
  }

  wait_for_success_timeout_seconds = 600
}
