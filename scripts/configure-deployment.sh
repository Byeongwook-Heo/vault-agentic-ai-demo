#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/aws-credentials.sh"
load_demo_aws_credentials
project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
input_file="${DEPLOYMENT_VARS_FILE:?Set DEPLOYMENT_VARS_FILE to your private Terraform JSON inputs}"
jq -e 'type == "object" and (.vpc_id | type == "string")' "${input_file}" >/dev/null
if grep -Eq 'REPLACE_|000000000000|123456789012|example\.com' "${input_file}"; then
  echo "Replace all example values before storing deployment inputs." >&2
  exit 2
fi
aws ssm put-parameter --name "/${project_name}/deployment/tfvars" \
  --type SecureString --overwrite --value "file://${input_file}" >/dev/null
echo "Private deployment inputs stored. They are not included in the source archive."
