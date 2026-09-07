#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/aws-credentials.sh"
load_demo_aws_credentials

command -v session-manager-plugin >/dev/null 2>&1 || {
  echo "AWS Session Manager plugin is required." >&2
  exit 1
}

project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
aws_region="${AWS_REGION:-ap-northeast-2}"
session_document="${project_name}-event-operator-shell"

instance_id="$(
  aws ec2 describe-instances \
    --region "${aws_region}" \
    --filters \
      "Name=tag:Name,Values=${project_name}-vault" \
      "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text
)"

if [[ -z "${instance_id}" || "${instance_id}" == "None" ]]; then
  echo "The running event Vault instance was not found." >&2
  exit 1
fi

echo "Opening an audited SSM session to ${instance_id}. Idle timeout: 20 minutes; maximum: 120 minutes."
aws ssm start-session \
  --region "${aws_region}" \
  --target "${instance_id}" \
  --document-name "${session_document}"
