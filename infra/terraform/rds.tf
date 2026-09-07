resource "aws_db_subnet_group" "orders" {
  name       = var.project_name
  subnet_ids = var.database_subnet_ids
}

resource "aws_db_parameter_group" "orders" {
  name   = "${var.project_name}-postgres16"
  family = "postgres16"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }
}

resource "aws_db_instance" "orders" {
  identifier = "${var.project_name}-orders"

  engine                      = "postgres"
  engine_version              = var.rds_engine_version
  instance_class              = var.rds_instance_class
  allocated_storage           = 20
  max_allocated_storage       = 100
  storage_type                = "gp3"
  storage_encrypted           = true
  kms_key_id                  = aws_kms_key.storage.arn
  db_name                     = "shop_demo"
  username                    = "vaultadmin"
  manage_master_user_password = true
  port                        = 5432

  db_subnet_group_name   = aws_db_subnet_group.orders.name
  vpc_security_group_ids = [aws_security_group.database.id]
  publicly_accessible    = false
  parameter_group_name   = aws_db_parameter_group.orders.name

  backup_retention_period             = 1
  copy_tags_to_snapshot               = true
  auto_minor_version_upgrade          = true
  enabled_cloudwatch_logs_exports     = ["postgresql"]
  performance_insights_enabled        = true
  performance_insights_kms_key_id     = aws_kms_key.storage.arn
  deletion_protection                 = true
  skip_final_snapshot                 = true
  apply_immediately                   = true
  allow_major_version_upgrade         = false
  iam_database_authentication_enabled = false
}

resource "aws_secretsmanager_secret" "vault_recovery" {
  name                    = "${var.project_name}/vault/recovery"
  description             = "Vault recovery key and initial root token; populated only by the private bootstrap job"
  kms_key_id              = aws_kms_key.storage.arn
  recovery_window_in_days = 7
}

resource "aws_ssm_parameter" "rds_endpoint" {
  name  = "/${var.project_name}/rds/endpoint"
  type  = "String"
  value = aws_db_instance.orders.address
}

resource "aws_ssm_parameter" "rds_database" {
  name  = "/${var.project_name}/rds/database"
  type  = "String"
  value = aws_db_instance.orders.db_name
}

resource "aws_ssm_parameter" "rds_master_secret_arn" {
  name  = "/${var.project_name}/rds/master-secret-arn"
  type  = "String"
  value = aws_db_instance.orders.master_user_secret[0].secret_arn
}
