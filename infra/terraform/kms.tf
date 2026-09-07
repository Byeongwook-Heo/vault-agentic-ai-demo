data "aws_iam_policy_document" "storage_key" {
  statement {
    sid    = "EnableAccountIamPolicies"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }

  statement {
    sid    = "AllowCloudWatchLogsEncryption"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["logs.${var.aws_region}.amazonaws.com"]
    }
    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:ReEncrypt*",
      "kms:GenerateDataKey*",
      "kms:DescribeKey"
    ]
    resources = ["*"]
    condition {
      test     = "ArnLike"
      variable = "kms:EncryptionContext:aws:logs:arn"
      values = [
        "arn:${data.aws_partition.current.partition}:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/ecs/${var.project_name}",
        "arn:${data.aws_partition.current.partition}:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/ssm/${var.project_name}/event-operator"
      ]
    }
  }
}

resource "aws_kms_key" "storage" {
  description             = "${var.project_name} storage encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.storage_key.json
}

resource "aws_kms_alias" "storage" {
  name          = "alias/${var.project_name}-storage"
  target_key_id = aws_kms_key.storage.key_id
}

resource "aws_kms_key" "vault_unseal" {
  description             = "${var.project_name} Vault auto-unseal"
  deletion_window_in_days = 7
  enable_key_rotation     = true
}

resource "aws_kms_alias" "vault_unseal" {
  name          = "alias/${var.project_name}-vault-unseal"
  target_key_id = aws_kms_key.vault_unseal.key_id
}

resource "aws_kms_key" "verify_signing" {
  description              = "${var.project_name} private_key_jwt signer"
  deletion_window_in_days  = 7
  customer_master_key_spec = "RSA_2048"
  key_usage                = "SIGN_VERIFY"
}

resource "aws_kms_alias" "verify_signing" {
  name          = "alias/${var.project_name}-verify-signing"
  target_key_id = aws_kms_key.verify_signing.key_id
}
