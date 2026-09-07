#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/aws-credentials.sh"

resolve_agent_runtime() {
  load_demo_aws_credentials
  AWS_REGION="${AWS_REGION:-ap-northeast-2}"
  local project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
  INSTANCE_ID="${AGENT_RUNTIME_INSTANCE_ID:-$(aws ssm get-parameter \
    --region "${AWS_REGION}" --name "/${project_name}/agent-runtime/instance-id" \
    --query Parameter.Value --output text)}"
  local instance_json
  instance_json="$(aws ec2 describe-instances --region "${AWS_REGION}" \
    --instance-ids "${INSTANCE_ID}" --query 'Reservations[0].Instances[0]' --output json)"
  if ! jq -e --arg name "${project_name}-agent-runtime" \
    'any(.Tags[]?; .Key == "Name" and .Value == $name)' <<<"${instance_json}" >/dev/null; then
    echo "Refusing to operate on an instance not owned by this lab." >&2
    return 2
  fi
  state="$(jq -er '.State.Name' <<<"${instance_json}")"
}
