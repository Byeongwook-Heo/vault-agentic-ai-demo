resource "aws_iam_role" "vault" {
  name = "${var.project_name}-vault"

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

resource "aws_iam_role_policy_attachment" "vault_ssm" {
  role       = aws_iam_role.vault.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "vault" {
  name = "vault-unseal-and-bootstrap"
  role = aws_iam_role.vault.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AutoUnseal"
        Effect   = "Allow"
        Action   = ["kms:Encrypt", "kms:Decrypt", "kms:DescribeKey"]
        Resource = aws_kms_key.vault_unseal.arn
      },
      {
        Sid      = "ReadEnterpriseLicense"
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/lab/vault/license"
      },
      {
        Sid      = "PublishPublicCa"
        Effect   = "Allow"
        Action   = ["ssm:PutParameter"]
        Resource = "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/vault/ca-pem"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "vault" {
  name = "${var.project_name}-vault"
  role = aws_iam_role.vault.name
}

resource "aws_instance" "vault" {
  ami                         = data.aws_ami.vault.id
  instance_type               = var.vault_instance_type
  subnet_id                   = var.app_subnet_ids[0]
  vpc_security_group_ids      = [aws_security_group.vault.id]
  iam_instance_profile        = aws_iam_instance_profile.vault.name
  associate_public_ip_address = false
  user_data_replace_on_change = true

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
    volume_size           = 30
    delete_on_termination = true
  }

  user_data = templatefile("${path.module}/templates/vault-user-data.sh.tftpl", {
    aws_region             = var.aws_region
    project_name           = var.project_name
    unseal_kms_key_id      = aws_kms_key.vault_unseal.key_id
    private_dns_name       = "vault.${var.project_name}.internal"
    vault_version          = var.vault_version
    license_parameter_name = "/${var.project_name}/lab/vault/license"
    ca_parameter_name      = "/${var.project_name}/vault/ca-pem"
  })

  tags = {
    Name = "${var.project_name}-vault"
  }

  lifecycle {
    precondition {
      condition     = data.aws_ami.vault.architecture == "x86_64"
      error_message = "Vault requires an approved x86_64 hc-base or hc-security-base AMI."
    }
  }
}

resource "aws_route53_record" "vault_private" {
  zone_id = aws_route53_zone.private.zone_id
  name    = "vault.${var.project_name}.internal"
  type    = "A"
  ttl     = 30
  records = [aws_instance.vault.private_ip]
}

resource "aws_ssm_parameter" "vault_address" {
  name  = "/${var.project_name}/vault/address"
  type  = "String"
  value = "https://${aws_route53_record.vault_private.fqdn}:8200"
}
