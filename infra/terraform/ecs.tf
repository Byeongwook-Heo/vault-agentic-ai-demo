resource "aws_ecs_cluster" "app" {
  name = var.project_name

  setting {
    name  = "containerInsights"
    value = "enhanced"
  }
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/aws/ecs/${var.project_name}"
  retention_in_days = 14
  kms_key_id        = aws_kms_key.storage.arn
}

resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_transport_secret" {
  count = var.deploy_service ? 1 : 0
  name  = "read-transport-token"
  role  = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = concat(
        [data.aws_secretsmanager_secret.transport_token[0].arn],
        var.chatbot_enabled ? [data.aws_secretsmanager_secret.chat_session[0].arn] : [],
        var.chatbot_enabled ? [data.aws_secretsmanager_secret.contextforge_runtime[0].arn] : [],
        var.chatbot_enabled && var.inference_enabled ? [data.aws_secretsmanager_secret.agent_runtime[0].arn] : []
      )
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_kms_signing" {
  name = "verify-private-key-jwt"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["kms:GetPublicKey", "kms:Sign"]
      Resource = aws_kms_key.verify_signing.arn
    }]
  })
}

locals {
  contextforge_server_id = "c0ffee00cafe40008000000000000001"

  base_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = "8080" },
    { name = "APP_MODE", value = var.app_mode },
    { name = "CHATBOT_ENABLED", value = tostring(var.chatbot_enabled) },
    { name = "IDENTITY_FLOW", value = var.chatbot_enabled ? "obo" : "client_credentials" },
    { name = "MCP_AUTH_MODE", value = var.chatbot_enabled ? "obo_jwt" : "static_bearer" },
    { name = "CONTEXTFORGE_ENABLED", value = tostring(var.chatbot_enabled) },
    { name = "CONTEXTFORGE_BASE_URL", value = var.chatbot_enabled ? "http://127.0.0.1:4444" : "" },
    { name = "CONTEXTFORGE_SERVER_ID", value = var.chatbot_enabled ? local.contextforge_server_id : "" },
    { name = "CONTEXTFORGE_ADMIN_EMAIL", value = var.chatbot_enabled ? "contextforge-admin@example.com" : "" },
    { name = "CONTEXTFORGE_UPSTREAM_URL", value = var.chatbot_enabled ? "http://127.0.0.1:8080/mcp" : "" },
    { name = "AGENT_PLANNING_MODE", value = var.chatbot_enabled && var.inference_enabled ? "private" : "bounded" },
    { name = "INFERENCE_BASE_URL", value = var.inference_enabled ? local.inference_endpoint : "" },
    { name = "INFERENCE_MODEL", value = var.inference_enabled ? nonsensitive(var.inference_model) : "" },
    { name = "INFERENCE_TIMEOUT_MS", value = "30000" },
    { name = "INFERENCE_KEEP_ALIVE", value = "30m" },
    { name = "SERVICE_VERSION", value = var.service_version },
    { name = "AWS_REGION", value = var.aws_region },
    { name = "ALLOWED_ORIGINS", value = "https://${local.fqdn}" },
    { name = "TRUST_PROXY", value = "true" },
    { name = "PUBLIC_BASE_URL", value = "https://${local.fqdn}" },
    { name = "MCP_INTERNAL_URL", value = var.chatbot_enabled ? "http://127.0.0.1:4444/servers/${local.contextforge_server_id}/mcp" : "http://127.0.0.1:8080/mcp" },
    { name = "VERIFY_KMS_KEY_ID", value = aws_kms_key.verify_signing.arn },
    { name = "ACCESS_TIER_ENFORCEMENT", value = var.access_tier_enforcement },
    { name = "VERIFY_ACCESS_TIER_CLAIM", value = var.verify_access_tier_claim },
    { name = "VERIFY_ACCESS_TIER_FULL_VALUE", value = var.verify_access_tier_full_value },
    { name = "VERIFY_ACCESS_TIER_LIMITED_VALUE", value = var.verify_access_tier_limited_value },
    { name = "VAULT_ADDR", value = "https://${aws_route53_record.vault_private.fqdn}:8200" },
    { name = "VAULT_NAMESPACE", value = "demo" },
    { name = "VAULT_JWT_AUTH_PATH", value = "jwt" },
    { name = "VAULT_JWT_ROLE", value = "bob-orders-full" },
    { name = "VAULT_DB_CREDS_PATH", value = "database/creds/bob-orders-full" },
    { name = "VAULT_LIMITED_JWT_ROLE", value = "bob-orders-limited" },
    { name = "VAULT_LIMITED_DB_CREDS_PATH", value = "database/creds/bob-orders-limited" },
    { name = "VAULT_CA_PEM", value = var.deploy_service ? nonsensitive(data.aws_ssm_parameter.vault_ca[0].value) : "" },
    { name = "DB_HOST", value = aws_db_instance.orders.address },
    { name = "DB_PORT", value = tostring(aws_db_instance.orders.port) },
    { name = "DB_NAME", value = aws_db_instance.orders.db_name },
    { name = "DB_CA_FILE", value = "/app/certs/rds-ca.pem" }
  ]

  verify_environment = local.legacy_identity_mode ? [
    { name = "VERIFY_TOKEN_URL", value = nonsensitive(data.aws_ssm_parameter.verify_token_url[0].value) },
    { name = "VERIFY_JWKS_URL", value = nonsensitive(data.aws_ssm_parameter.verify_jwks_url[0].value) },
    { name = "VERIFY_ISSUER", value = nonsensitive(data.aws_ssm_parameter.verify_issuer[0].value) },
    { name = "VERIFY_AUDIENCE", value = nonsensitive(data.aws_ssm_parameter.verify_audience[0].value) },
    { name = "VERIFY_CLIENT_ID", value = nonsensitive(data.aws_ssm_parameter.verify_client_id[0].value) },
    { name = "VERIFY_SCOPE", value = nonsensitive(data.aws_ssm_parameter.verify_scope[0].value) },
    { name = "VERIFY_NHI_CLAIM", value = nonsensitive(data.aws_ssm_parameter.verify_nhi_claim[0].value) },
    { name = "VERIFY_NHI_VALUE", value = nonsensitive(data.aws_ssm_parameter.verify_nhi_value[0].value) }
  ] : []

  chatbot_verify_environment = local.chatbot_identity_mode ? [
    { name = "VERIFY_USER_AUTHORIZATION_URL", value = nonsensitive(data.aws_ssm_parameter.verify_user_authorization_url[0].value) },
    { name = "VERIFY_USER_TOKEN_URL", value = nonsensitive(data.aws_ssm_parameter.verify_user_token_url[0].value) },
    { name = "VERIFY_USER_JWKS_URL", value = nonsensitive(data.aws_ssm_parameter.verify_user_jwks_url[0].value) },
    { name = "VERIFY_USER_ISSUER", value = nonsensitive(data.aws_ssm_parameter.verify_user_issuer[0].value) },
    { name = "VERIFY_USER_AUDIENCE", value = nonsensitive(data.aws_ssm_parameter.verify_user_audience[0].value) },
    { name = "VERIFY_USER_CLIENT_ID", value = nonsensitive(data.aws_ssm_parameter.verify_user_client_id[0].value) },
    { name = "VERIFY_USER_SCOPES", value = nonsensitive(data.aws_ssm_parameter.verify_user_scopes[0].value) },
    { name = "VERIFY_OBO_TOKEN_URL", value = nonsensitive(data.aws_ssm_parameter.verify_obo_token_url[0].value) },
    { name = "VERIFY_OBO_JWKS_URL", value = nonsensitive(data.aws_ssm_parameter.verify_obo_jwks_url[0].value) },
    { name = "VERIFY_OBO_ISSUER", value = nonsensitive(data.aws_ssm_parameter.verify_obo_issuer[0].value) },
    { name = "VERIFY_OBO_AUDIENCE", value = nonsensitive(data.aws_ssm_parameter.verify_obo_audience[0].value) },
    { name = "VERIFY_OBO_CLIENT_ID", value = nonsensitive(data.aws_ssm_parameter.verify_obo_client_id[0].value) },
    { name = "VERIFY_OBO_SCOPE", value = nonsensitive(data.aws_ssm_parameter.verify_obo_scope[0].value) },
    { name = "VERIFY_OBO_ACTOR_CLAIM", value = nonsensitive(data.aws_ssm_parameter.verify_obo_actor_claim[0].value) },
    { name = "VERIFY_OBO_ACTOR_VALUE", value = nonsensitive(data.aws_ssm_parameter.verify_obo_actor_value[0].value) }
  ] : []

  app_secrets = var.deploy_service ? concat(
    [{
      name      = "TRANSPORT_BEARER_TOKEN"
      valueFrom = data.aws_secretsmanager_secret.transport_token[0].arn
    }],
    var.chatbot_enabled ? [{
      name      = "SESSION_SECRET"
      valueFrom = data.aws_secretsmanager_secret.chat_session[0].arn
      }, {
      name      = "CONTEXTFORGE_ADMIN_PASSWORD"
      valueFrom = "${data.aws_secretsmanager_secret.contextforge_runtime[0].arn}:admin_password::"
    }] : [],
    var.chatbot_enabled && var.inference_enabled ? [{
      name      = "INFERENCE_API_TOKEN"
      valueFrom = data.aws_secretsmanager_secret.agent_runtime[0].arn
    }] : []
  ) : []

  contextforge_environment = [
    { name = "ENVIRONMENT", value = "production" },
    { name = "HOST", value = "0.0.0.0" },
    { name = "PORT", value = "4444" },
    { name = "DATABASE_URL", value = "sqlite:////tmp/contextforge.db" },
    { name = "AUTH_REQUIRED", value = "true" },
    { name = "MCP_REQUIRE_AUTH", value = "true" },
    { name = "SSRF_ALLOW_LOCALHOST", value = "true" },
    { name = "SSRF_ALLOW_PRIVATE_NETWORKS", value = "false" },
    { name = "EMAIL_AUTH_ENABLED", value = "true" },
    { name = "REQUIRE_USER_IN_DB", value = "false" },
    { name = "MCPGATEWAY_UI_ENABLED", value = "false" },
    { name = "MCPGATEWAY_ADMIN_API_ENABLED", value = "true" },
    { name = "PLATFORM_ADMIN_EMAIL", value = "contextforge-admin@example.com" },
    { name = "PLATFORM_ADMIN_FULL_NAME", value = "Agentic Security Lab Gateway" },
    { name = "SECURE_COOKIES", value = "false" }
  ]

  contextforge_secrets = var.deploy_service && var.chatbot_enabled ? [
    {
      name      = "JWT_SECRET_KEY"
      valueFrom = "${data.aws_secretsmanager_secret.contextforge_runtime[0].arn}:jwt_secret_key::"
    },
    {
      name      = "AUTH_ENCRYPTION_SECRET"
      valueFrom = "${data.aws_secretsmanager_secret.contextforge_runtime[0].arn}:auth_encryption_secret::"
    },
    {
      name      = "PLATFORM_ADMIN_PASSWORD"
      valueFrom = "${data.aws_secretsmanager_secret.contextforge_runtime[0].arn}:admin_password::"
    }
  ] : []
}

resource "aws_ecs_task_definition" "app" {
  count = var.deploy_service ? 1 : 0

  family                   = var.project_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.chatbot_enabled ? 1024 : 512
  memory                   = var.chatbot_enabled ? 2048 : 1024
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode(concat([
    {
      name                   = "mcp"
      image                  = nonsensitive(data.aws_ssm_parameter.image_uri[0].value)
      essential              = true
      cpu                    = var.chatbot_enabled ? 512 : 0
      readonlyRootFilesystem = true
      user                   = "10001:10001"
      dependsOn = var.chatbot_enabled ? [{
        containerName = "contextforge"
        condition     = "HEALTHY"
      }] : []
      portMappings = [{
        containerPort = 8080
        hostPort      = 8080
        protocol      = "tcp"
      }]
      environment = concat(local.base_environment, local.verify_environment, local.chatbot_verify_environment)
      secrets     = local.app_secrets
      linuxParameters = {
        initProcessEnabled = true
        capabilities = {
          drop = ["ALL"]
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:8080/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 90
      }
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.app.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "mcp"
        }
      }
    }
    ], var.chatbot_enabled ? [{
      name                   = "contextforge"
      image                  = var.contextforge_image
      essential              = true
      cpu                    = 512
      readonlyRootFilesystem = false
      portMappings = [{
        containerPort = 4444
        hostPort      = 4444
        protocol      = "tcp"
      }]
      environment = local.contextforge_environment
      secrets     = local.contextforge_secrets
      linuxParameters = {
        initProcessEnabled = true
        capabilities = {
          drop = ["ALL"]
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:4444/health', timeout=3)\""]
        interval    = 15
        timeout     = 5
        retries     = 5
        startPeriod = 60
      }
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.app.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "contextforge"
        }
      }
  }] : []))

  depends_on = [aws_iam_role_policy.ecs_transport_secret]
}

resource "aws_ecs_service" "app" {
  count = var.deploy_service ? 1 : 0

  name                               = var.project_name
  cluster                            = aws_ecs_cluster.app.id
  task_definition                    = aws_ecs_task_definition.app[0].arn
  desired_count                      = 1
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 180
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  enable_execute_command             = false
  wait_for_steady_state              = true

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.app_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "mcp"
    container_port   = 8080
  }

  depends_on = [aws_lb_listener.https]
}
