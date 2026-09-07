#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${project_dir}/scripts/aws-credentials.sh"
load_demo_aws_credentials

project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
secret_name="${project_name}/contextforge/runtime"
if aws secretsmanager describe-secret --secret-id "${secret_name}" >/dev/null 2>&1; then
  echo "ContextForge runtime secret already exists; it was not rotated."
  exit 0
fi

secret_file="$(mktemp)"
trap 'rm -f "${secret_file}"' EXIT
chmod 0600 "${secret_file}"

jwt_secret="$(openssl rand -base64 48 | tr -d '\n')"
encryption_secret="$(openssl rand -base64 48 | tr -d '\n')"
admin_password="$(openssl rand -base64 36 | tr -d '\n')"
jq -n \
  --arg jwt_secret_key "${jwt_secret}" \
  --arg auth_encryption_secret "${encryption_secret}" \
  --arg admin_password "${admin_password}" \
  '{jwt_secret_key: $jwt_secret_key, auth_encryption_secret: $auth_encryption_secret, admin_password: $admin_password}' \
  >"${secret_file}"

aws secretsmanager create-secret \
  --name "${secret_name}" \
  --description "Private runtime secrets for the ContextForge MCP Gateway sidecar" \
  --secret-string "file://${secret_file}" >/dev/null

echo "ContextForge runtime secret created in Secrets Manager."
