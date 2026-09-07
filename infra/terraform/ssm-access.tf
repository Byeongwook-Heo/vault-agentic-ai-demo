resource "aws_cloudwatch_log_group" "ssm_sessions" {
  name              = "/aws/ssm/${var.project_name}/event-operator"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.storage.arn
}

resource "aws_ssm_document" "event_operator_shell" {
  name            = "${var.project_name}-event-operator-shell"
  document_type   = "Session"
  document_format = "JSON"

  content = jsonencode({
    schemaVersion = "1.0"
    description   = "Audited shell access to the event Vault EC2 instance"
    sessionType   = "Standard_Stream"
    inputs = {
      s3BucketName                = ""
      s3KeyPrefix                 = ""
      s3EncryptionEnabled         = true
      cloudWatchLogGroupName      = aws_cloudwatch_log_group.ssm_sessions.name
      cloudWatchEncryptionEnabled = true
      cloudWatchStreamingEnabled  = true
      kmsKeyId                    = ""
      runAsEnabled                = false
      runAsDefaultUser            = ""
      idleSessionTimeout          = "20"
      maxSessionDuration          = "120"
      shellProfile = {
        windows = ""
        linux   = "umask 077; export HISTTIMEFORMAT='%F %T '"
      }
    }
  })

  tags = {
    Name = "${var.project_name}-event-operator-shell"
  }
}

data "aws_iam_policy_document" "event_operator_trust" {
  statement {
    sid     = "TrustedEventOperatorsOnly"
    effect  = "Allow"
    actions = ["sts:AssumeRole", "sts:SetSourceIdentity"]

    principals {
      type        = "AWS"
      identifiers = var.event_operator_principal_arns
    }

    condition {
      test     = "DateLessThan"
      variable = "aws:CurrentTime"
      values   = [var.event_access_expires_at]
    }

    condition {
      test     = "StringLike"
      variable = "sts:RoleSessionName"
      values   = ["event-*"]
    }
  }
}

resource "aws_iam_role" "event_operator" {
  name                 = "${var.project_name}-event-operator"
  description          = "Time-bounded, audited SSM access to the event Vault EC2 instance"
  assume_role_policy   = data.aws_iam_policy_document.event_operator_trust.json
  max_session_duration = 14400

  tags = {
    Name               = "${var.project_name}-event-operator"
    EventAccessExpires = var.event_access_expires_at
  }
}

resource "aws_iam_role_policy" "event_operator" {
  name = "vault-ec2-ssm-session-only"
  role = aws_iam_role.event_operator.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "StartAuditedSessionOnVaultOnly"
        Effect   = "Allow"
        Action   = ["ssm:StartSession"]
        Resource = [aws_instance.vault.arn, aws_ssm_document.event_operator_shell.arn]
        Condition = {
          DateLessThan = {
            "aws:CurrentTime" = var.event_access_expires_at
          }
        }
      },
      {
        Sid      = "OpenOwnSessionDataChannel"
        Effect   = "Allow"
        Action   = ["ssmmessages:OpenDataChannel"]
        Resource = "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:session/$${aws:userid}-*"
      },
      {
        Sid      = "ManageOwnSessions"
        Effect   = "Allow"
        Action   = ["ssm:ResumeSession", "ssm:TerminateSession"]
        Resource = "arn:${data.aws_partition.current.partition}:ssm:*:*:session/$${aws:userid}-*"
      },
      {
        Sid    = "ReadConnectionMetadata"
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ssm:DescribeInstanceInformation",
          "ssm:DescribeInstanceProperties",
          "ssm:DescribeSessions",
          "ssm:GetConnectionStatus",
          "ssm:ListDocuments"
        ]
        Resource = "*"
      },
      {
        Sid      = "ReadApprovedSessionDocument"
        Effect   = "Allow"
        Action   = ["ssm:GetDocument"]
        Resource = aws_ssm_document.event_operator_shell.arn
      },
      {
        Sid      = "ReadEventSessionTranscripts"
        Effect   = "Allow"
        Action   = ["logs:DescribeLogStreams", "logs:GetLogEvents", "logs:FilterLogEvents"]
        Resource = "${aws_cloudwatch_log_group.ssm_sessions.arn}:*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "vault_ssm_session_logging" {
  name = "publish-audited-ssm-sessions"
  role = aws_iam_role.vault.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "DescribeSessionLogGroups"
        Effect   = "Allow"
        Action   = ["logs:DescribeLogGroups", "logs:DescribeLogStreams"]
        Resource = "*"
      },
      {
        Sid      = "PublishSessionTranscript"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.ssm_sessions.arn}:*"
      }
    ]
  })
}
