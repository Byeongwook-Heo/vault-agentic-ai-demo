#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${project_dir}/scripts/aws-credentials.sh"
load_demo_aws_credentials

project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
secret_name="${project_name}/mcp/transport-token"
if aws secretsmanager describe-secret --secret-id "${secret_name}" >/dev/null 2>&1; then
  echo "MCP transport secret already exists; it was not rotated."
  exit 0
fi

token_file="$(mktemp)"
trap 'rm -f "${token_file}"' EXIT
chmod 0600 "${token_file}"
openssl rand -base64 48 | tr -d '\n' >"${token_file}"

aws secretsmanager create-secret \
  --name "${secret_name}" \
  --description "Bearer token for the Bob MCP transport; value is never placed in Terraform state" \
  --secret-string "file://${token_file}" >/dev/null

echo "MCP transport secret created in Secrets Manager."
