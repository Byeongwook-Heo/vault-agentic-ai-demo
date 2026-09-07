data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

data "aws_vpc" "selected" {
  id = var.vpc_id
}

data "aws_ami" "vault" {
  owners      = [var.vault_ami_owner]
  most_recent = true

  filter {
    name   = "image-id"
    values = [var.vault_ami_id]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "name"
    values = ["hc-base-*", "hc-security-base-*"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

data "aws_security_group" "codebuild" {
  filter {
    name   = "tag:Name"
    values = ["${var.project_name}-codebuild"]
  }

  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }
}

data "aws_ssm_parameter" "allowed_source_cidrs" {
  name            = "/${var.project_name}/allowed-source-cidrs"
  with_decryption = false
}

data "aws_ecr_repository" "app" {
  name = var.project_name
}

data "aws_ssm_parameter" "image_uri" {
  count           = var.deploy_service ? 1 : 0
  name            = "/${var.project_name}/image-uri"
  with_decryption = false
}

data "aws_ssm_parameter" "vault_ca" {
  count           = var.deploy_service ? 1 : 0
  name            = "/${var.project_name}/vault/ca-pem"
  with_decryption = false
}

data "aws_secretsmanager_secret" "transport_token" {
  count = var.deploy_service ? 1 : 0
  name  = "${var.project_name}/mcp/transport-token"
}

data "aws_secretsmanager_secret" "chat_session" {
  count = var.deploy_service && var.chatbot_enabled ? 1 : 0
  name  = "${var.project_name}/chat/session-secret"
}

data "aws_secretsmanager_secret" "contextforge_runtime" {
  count = var.deploy_service && var.chatbot_enabled ? 1 : 0
  name  = "${var.project_name}/contextforge/runtime"
}

data "aws_secretsmanager_secret" "agent_runtime" {
  count = var.deploy_service && var.chatbot_enabled && var.inference_enabled ? 1 : 0
  name  = "${var.project_name}/chat/agent-runtime-token"
}

locals {
  fqdn                   = "${var.hostname}.${var.public_zone_name}"
  allowed_source_cidrs   = split(",", nonsensitive(data.aws_ssm_parameter.allowed_source_cidrs.value))
  verify_jwks_source_ips = { for index, cidr in var.verify_jwks_source_cidrs : cidr => index }
  full_identity_mode     = var.deploy_service && var.app_mode == "aws"
  legacy_identity_mode   = local.full_identity_mode && !var.chatbot_enabled
  chatbot_identity_mode  = local.full_identity_mode && var.chatbot_enabled
}

data "aws_ssm_parameter" "verify_token_url" {
  count           = local.legacy_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/token-url"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_jwks_url" {
  count           = local.legacy_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/jwks-url"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_issuer" {
  count           = local.legacy_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/issuer"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_audience" {
  count           = local.legacy_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/audience"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_client_id" {
  count           = local.legacy_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/client-id"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_scope" {
  count           = local.legacy_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/scope"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_nhi_claim" {
  count           = local.legacy_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/nhi-claim"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_nhi_value" {
  count           = local.legacy_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/nhi-value"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_user_authorization_url" {
  count           = local.chatbot_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/user/authorization-url"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_user_token_url" {
  count           = local.chatbot_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/user/token-url"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_user_jwks_url" {
  count           = local.chatbot_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/user/jwks-url"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_user_issuer" {
  count           = local.chatbot_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/user/issuer"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_user_audience" {
  count           = local.chatbot_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/user/audience"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_user_client_id" {
  count           = local.chatbot_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/user/client-id"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_user_scopes" {
  count           = local.chatbot_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/user/scopes"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_obo_token_url" {
  count           = local.chatbot_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/obo/token-url"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_obo_jwks_url" {
  count           = local.chatbot_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/obo/jwks-url"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_obo_issuer" {
  count           = local.chatbot_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/obo/issuer"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_obo_audience" {
  count           = local.chatbot_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/obo/audience"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_obo_client_id" {
  count           = local.chatbot_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/obo/client-id"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_obo_scope" {
  count           = local.chatbot_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/obo/scope"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_obo_actor_claim" {
  count           = local.chatbot_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/obo/actor-claim"
  with_decryption = false
}

data "aws_ssm_parameter" "verify_obo_actor_value" {
  count           = local.chatbot_identity_mode ? 1 : 0
  name            = "/${var.project_name}/verify/obo/actor-value"
  with_decryption = false
}
