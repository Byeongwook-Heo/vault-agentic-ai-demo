locals {
  managed_inference           = var.deploy_service && var.chatbot_enabled && var.inference_enabled && var.manage_inference_runtime
  inference_endpoint          = local.managed_inference ? "http://${aws_instance.agent_runtime[0].private_ip}:11434" : var.inference_base_url
  inference_security_group_id = local.managed_inference ? aws_security_group.agent_runtime[0].id : var.inference_security_group_id
}

resource "aws_security_group" "agent_runtime" {
  count       = local.managed_inference ? 1 : 0
  name        = "${var.project_name}-agent-runtime"
  description = "Private inference traffic from this lab only"
  vpc_id      = var.vpc_id
  tags        = { Name = "${var.project_name}-agent-runtime" }
}

resource "aws_vpc_security_group_egress_rule" "agent_runtime_https" {
  count             = local.managed_inference ? 1 : 0
  security_group_id = aws_security_group.agent_runtime[0].id
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_iam_role" "agent_runtime" {
  count = local.managed_inference ? 1 : 0
  name  = "${var.project_name}-agent-runtime"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "agent_runtime_ssm" {
  count      = local.managed_inference ? 1 : 0
  role       = aws_iam_role.agent_runtime[0].name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "agent_runtime_secret" {
  count = local.managed_inference ? 1 : 0
  name  = "read-own-runtime-token"
  role  = aws_iam_role.agent_runtime[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = data.aws_secretsmanager_secret.agent_runtime[0].arn
    }]
  })
}

resource "aws_iam_instance_profile" "agent_runtime" {
  count = local.managed_inference ? 1 : 0
  name  = "${var.project_name}-agent-runtime"
  role  = aws_iam_role.agent_runtime[0].name
}

resource "aws_instance" "agent_runtime" {
  count                       = local.managed_inference ? 1 : 0
  ami                         = data.aws_ami.vault.id
  instance_type               = var.inference_instance_type
  subnet_id                   = var.app_subnet_ids[0]
  vpc_security_group_ids      = [aws_security_group.agent_runtime[0].id]
  iam_instance_profile        = aws_iam_instance_profile.agent_runtime[0].name
  associate_public_ip_address = false
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
    volume_size           = 24
    delete_on_termination = true
  }

  user_data = templatefile("${path.module}/templates/agent-runtime-user-data.sh.tftpl", {
    aws_region = var.aws_region
    secret_id  = data.aws_secretsmanager_secret.agent_runtime[0].name
    model      = nonsensitive(var.inference_model)
  })

  tags = { Name = "${var.project_name}-agent-runtime" }
  depends_on = [
    aws_iam_role_policy_attachment.agent_runtime_ssm,
    aws_iam_role_policy.agent_runtime_secret,
    aws_vpc_security_group_egress_rule.agent_runtime_https
  ]
}

resource "aws_ssm_parameter" "agent_runtime_instance" {
  count = local.managed_inference ? 1 : 0
  name  = "/${var.project_name}/agent-runtime/instance-id"
  type  = "String"
  value = aws_instance.agent_runtime[0].id
}

resource "aws_ssm_parameter" "agent_runtime_endpoint" {
  count = local.managed_inference ? 1 : 0
  name  = "/${var.project_name}/agent-runtime/endpoint"
  type  = "String"
  value = local.inference_endpoint
}
