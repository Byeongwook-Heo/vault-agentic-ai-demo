variable "project_name" {
  description = "Stable project prefix."
  type        = string
  default     = "bob-vault-nhi-demo"
}

variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "ap-northeast-2"
}

variable "vpc_id" {
  description = "Existing lab VPC."
  type        = string
}

variable "public_subnet_ids" {
  description = "Existing public subnets for the ALB."
  type        = list(string)
}

variable "app_subnet_ids" {
  description = "Existing NAT-routed private subnets for ECS and Vault."
  type        = list(string)
}

variable "database_subnet_ids" {
  description = "Existing isolated database subnets."
  type        = list(string)
}

variable "hosted_zone_id" {
  description = "Existing public Route 53 hosted zone."
  type        = string
}

variable "public_zone_name" {
  description = "Existing public DNS zone."
  type        = string
}

variable "hostname" {
  description = "Public hostname label for Bob and the dashboard."
  type        = string
  default     = "bob-vault-demo"
}

variable "vault_ami_id" {
  description = "Approved x86_64 hardened base AMI."
  type        = string
}

variable "vault_ami_owner" {
  description = "Trusted owner of the approved base AMI."
  type        = string
}

variable "vault_instance_type" {
  description = "Single-node demo Vault instance size."
  type        = string
  default     = "t3.medium"
}

variable "vault_version" {
  description = "Vault binary version used in the Vault EC2 user-data bootstrap."
  type        = string
  default     = "2.1.0+ent"
}

variable "deploy_service" {
  description = "Whether to deploy the ECS task and service."
  type        = bool
  default     = false
}

variable "app_mode" {
  description = "Bootstrap exposes health, dashboard, and public JWK; aws enforces the complete identity flow."
  type        = string
  default     = "bootstrap"

  validation {
    condition     = contains(["bootstrap", "aws"], var.app_mode)
    error_message = "app_mode must be bootstrap or aws."
  }
}

variable "chatbot_enabled" {
  description = "Enable IBM Verify user login, OBO token exchange, and the sample chatbot."
  type        = bool
  default     = false
}

variable "contextforge_image" {
  description = "Pinned IBM ContextForge MCP Gateway image used as a private ECS sidecar."
  type        = string
  default     = "ghcr.io/ibm/mcp-context-forge:v1.0.6"

  validation {
    condition     = can(regex("^ghcr\\.io/ibm/mcp-context-forge:v[0-9]+\\.[0-9]+\\.[0-9]+$", var.contextforge_image))
    error_message = "contextforge_image must use an explicit v-prefixed semantic-version tag from the IBM GHCR repository."
  }
}

variable "inference_enabled" {
  description = "Enable the private intent-planning service with deterministic fallback."
  type        = bool
  default     = false
}

variable "manage_inference_runtime" {
  description = "Provision a dedicated private inference instance with the lab."
  type        = bool
  default     = true
}

variable "inference_instance_type" {
  description = "CPU inference instance size; no public endpoint is created."
  type        = string
  default     = "c7i.2xlarge"
}

variable "inference_base_url" {
  description = "Private URL for the intent-planning service."
  type        = string
  default     = "http://10.0.1.10:11434"

  validation {
    condition     = can(regex("^http://10\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}:[0-9]{2,5}$", var.inference_base_url))
    error_message = "inference_base_url must be an explicit private 10/8 HTTP endpoint with a port."
  }
}

variable "inference_model" {
  description = "Server-side intent-planning model identifier; never returned by the public API."
  type        = string
  default     = "qwen2.5:3b"
  sensitive   = true

  validation {
    condition     = can(regex("^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$", var.inference_model))
    error_message = "inference_model must be a safe model identifier."
  }
}

variable "inference_security_group_id" {
  description = "Existing security group on the private intent-planning instance."
  type        = string
  default     = ""

  validation {
    condition     = var.manage_inference_runtime || can(regex("^sg-[0-9a-f]{8,17}$", var.inference_security_group_id))
    error_message = "inference_security_group_id must be a security group ID."
  }
}

variable "service_version" {
  description = "Reader-facing release identifier."
  type        = string
  default     = "0.1.0"
}

variable "access_tier_enforcement" {
  description = "User access-tier enforcement mode. Production defaults to fail-closed enforcement of the configured Verify claim."
  type        = string
  default     = "enforce"

  validation {
    condition     = contains(["off", "audit", "enforce"], var.access_tier_enforcement)
    error_message = "access_tier_enforcement must be off, audit, or enforce."
  }
}

variable "verify_access_tier_claim" {
  description = "Signed Verify claim carrying the protected-order access tier."
  type        = string
  default     = "access_tier"
}

variable "verify_access_tier_full_value" {
  description = "Verify claim value mapped to full non-sensitive order access."
  type        = string
  default     = "orders-full"
}

variable "verify_access_tier_limited_value" {
  description = "Verify claim value mapped to the limited customer-scope order view."
  type        = string
  default     = "orders-limited"
}

variable "verify_jwks_source_cidrs" {
  description = "Official IBM Verify Europe egress CIDRs allowed to retrieve only the public client JWKS."
  type        = list(string)
  default = [
    "159.122.122.57/32",
    "159.122.122.60/32",
    "169.50.174.103/32",
    "169.50.174.14/32",
    "35.180.161.22/32",
    "15.188.92.17/32",
    "13.36.19.201/32",
    "52.29.222.95/32",
    "3.66.207.203/32",
    "18.184.196.56/32",
  ]

  validation {
    condition = length(var.verify_jwks_source_cidrs) > 0 && alltrue([
      for cidr in var.verify_jwks_source_cidrs :
      can(cidrnetmask(cidr)) && endswith(cidr, "/32")
    ])
    error_message = "verify_jwks_source_cidrs must contain explicit IPv4 /32 addresses."
  }
}

variable "rds_engine_version" {
  description = "PostgreSQL version available in ap-northeast-2."
  type        = string
  default     = "16.14"
}

variable "rds_instance_class" {
  description = "Demo database instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "event_operator_principal_arns" {
  description = "Exact IAM role ARNs allowed to assume the time-bounded EC2 event operator role. Never use account root or wildcard principals."
  type        = list(string)


  validation {
    condition = length(var.event_operator_principal_arns) > 0 && alltrue([
      for arn in var.event_operator_principal_arns :
      can(regex("^arn:[a-z0-9-]+:iam::[0-9]{12}:role/[A-Za-z0-9+=,.@_/-]+$", arn))
    ])
    error_message = "event_operator_principal_arns must contain exact IAM role ARNs; STS session ARNs, account root principals, and wildcards are not allowed."
  }
}

variable "event_access_expires_at" {
  description = "UTC time after which new event operator role assumptions and SSM sessions are denied."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$", var.event_access_expires_at))
    error_message = "event_access_expires_at must be an RFC 3339 UTC timestamp ending in Z."
  }
}

variable "event_ssh_users" {
  description = "Per-person public SSH keys allowed through the event bastion. Private .pem files must never be committed or uploaded."
  type = map(object({
    public_key = string
  }))
  default = {}

  validation {
    condition = alltrue([
      for username, config in var.event_ssh_users :
      can(regex("^[a-z][a-z0-9_-]{1,30}$", username)) &&
      can(regex("^ssh-(rsa|ed25519) [A-Za-z0-9+/=]+( [A-Za-z0-9 .@_-]+)?$", trimspace(config.public_key)))
    ])
    error_message = "event_ssh_users must use safe Linux usernames and valid RSA or Ed25519 public keys with safe comments."
  }
}

variable "event_ssh_expires_at" {
  description = "OpenSSH 8.9-compatible authorized_keys expiry in UTC for event access."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{14}$", var.event_ssh_expires_at))
    error_message = "event_ssh_expires_at must use OpenSSH 8.9-compatible UTC format YYYYMMDDHHMMSS."
  }
}

variable "event_ssh_expiry_calendar" {
  description = "Systemd UTC calendar expression that terminates existing event SSH sessions."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2} UTC$", var.event_ssh_expiry_calendar))
    error_message = "event_ssh_expiry_calendar must use YYYY-MM-DD HH:MM:SS UTC."
  }
}
