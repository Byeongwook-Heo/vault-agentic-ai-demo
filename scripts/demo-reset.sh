#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/aws-credentials.sh"
load_demo_aws_credentials

project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
aws ecs update-service \
  --cluster "${project_name}" \
  --service "${project_name}" \
  --force-new-deployment \
  --query 'service.serviceName' \
  --output text >/dev/null
echo "A fresh MCP task was requested; in-memory demo events will reset when it is healthy."
