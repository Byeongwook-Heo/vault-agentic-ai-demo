#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/aws-credentials.sh"
load_demo_aws_credentials

command -v session-manager-plugin >/dev/null 2>&1 || {
  echo "AWS Session Manager plugin is required for this optional local port forward." >&2
  exit 1
}

project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
instance_id="$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${project_name}-vault" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text)"

aws ssm start-session \
  --target "${instance_id}" \
  --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["8200"],"localPortNumber":["8200"]}'
