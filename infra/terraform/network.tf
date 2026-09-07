resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb"
  description = "TLS ingress from explicitly approved Bob source ranges"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-alb"
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  for_each = toset(local.allowed_source_cidrs)

  security_group_id = aws_security_group.alb.id
  description       = "Bob IDE and operator source"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = each.value
}

resource "aws_vpc_security_group_ingress_rule" "alb_verify_jwks_https" {
  for_each = local.verify_jwks_source_ips

  security_group_id = aws_security_group.alb.id
  description       = "IBM Verify Europe public JWKS retrieval"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = each.key
}

resource "aws_security_group" "ecs" {
  name        = "${var.project_name}-ecs"
  description = "Private MCP tasks"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-ecs"
  }
}

resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id            = aws_security_group.ecs.id
  description                  = "MCP and dashboard from ALB"
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_security_group" "vault" {
  name        = "${var.project_name}-vault"
  description = "Private Vault Enterprise listener"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-vault"
  }
}

resource "aws_vpc_security_group_ingress_rule" "vault_from_ecs" {
  security_group_id            = aws_security_group.vault.id
  description                  = "Vault API from MCP tasks"
  ip_protocol                  = "tcp"
  from_port                    = 8200
  to_port                      = 8200
  referenced_security_group_id = aws_security_group.ecs.id
}

resource "aws_vpc_security_group_ingress_rule" "vault_from_codebuild" {
  security_group_id            = aws_security_group.vault.id
  description                  = "Vault API from private bootstrap jobs"
  ip_protocol                  = "tcp"
  from_port                    = 8200
  to_port                      = 8200
  referenced_security_group_id = data.aws_security_group.codebuild.id
}

resource "aws_security_group" "database" {
  name        = "${var.project_name}-database"
  description = "Private RDS PostgreSQL"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-database"
  }
}

resource "aws_vpc_security_group_ingress_rule" "database_clients" {
  for_each = {
    ecs       = aws_security_group.ecs.id
    vault     = aws_security_group.vault.id
    codebuild = data.aws_security_group.codebuild.id
  }

  security_group_id            = aws_security_group.database.id
  description                  = "PostgreSQL from ${each.key}"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = each.value
}

resource "aws_vpc_security_group_egress_rule" "alb_to_ecs" {
  security_group_id            = aws_security_group.alb.id
  description                  = "ALB to MCP targets"
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.ecs.id
}

resource "aws_vpc_security_group_egress_rule" "ecs_https" {
  security_group_id = aws_security_group.ecs.id
  description       = "AWS APIs and IBM Verify through NAT"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "ecs_to_vault" {
  security_group_id            = aws_security_group.ecs.id
  description                  = "MCP to Vault"
  ip_protocol                  = "tcp"
  from_port                    = 8200
  to_port                      = 8200
  referenced_security_group_id = aws_security_group.vault.id
}

resource "aws_vpc_security_group_egress_rule" "ecs_to_database" {
  security_group_id            = aws_security_group.ecs.id
  description                  = "MCP to PostgreSQL with dynamic credentials"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.database.id
}

resource "aws_vpc_security_group_egress_rule" "ecs_to_agent_runtime" {
  count = var.inference_enabled ? 1 : 0

  security_group_id            = aws_security_group.ecs.id
  description                  = "ECS to private agent planning runtime"
  ip_protocol                  = "tcp"
  from_port                    = 11434
  to_port                      = 11434
  referenced_security_group_id = local.inference_security_group_id
}

resource "aws_vpc_security_group_ingress_rule" "agent_runtime_from_ecs" {
  count = var.inference_enabled ? 1 : 0

  security_group_id            = local.inference_security_group_id
  description                  = "Private agent planning requests from the lab ECS service"
  ip_protocol                  = "tcp"
  from_port                    = 11434
  to_port                      = 11434
  referenced_security_group_id = aws_security_group.ecs.id
}

resource "aws_vpc_security_group_egress_rule" "vault_https" {
  security_group_id = aws_security_group.vault.id
  description       = "AWS APIs through NAT"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "vault_to_database" {
  security_group_id            = aws_security_group.vault.id
  description                  = "Vault database plugin to PostgreSQL"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.database.id
}

resource "aws_vpc_security_group_egress_rule" "dns_udp" {
  for_each = {
    ecs   = aws_security_group.ecs.id
    vault = aws_security_group.vault.id
  }

  security_group_id = each.value
  description       = "VPC DNS"
  ip_protocol       = "udp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = data.aws_vpc.selected.cidr_block
}

resource "aws_vpc_security_group_egress_rule" "dns_tcp" {
  for_each = {
    ecs   = aws_security_group.ecs.id
    vault = aws_security_group.vault.id
  }

  security_group_id = each.value
  description       = "VPC DNS fallback"
  ip_protocol       = "tcp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = data.aws_vpc.selected.cidr_block
}

resource "aws_route53_zone" "private" {
  name = "${var.project_name}.internal"

  vpc {
    vpc_id = var.vpc_id
  }
}
