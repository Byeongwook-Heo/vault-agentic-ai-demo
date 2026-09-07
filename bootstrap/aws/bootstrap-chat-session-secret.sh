#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${project_dir}/scripts/aws-credentials.sh"
load_demo_aws_credentials

project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
secret_name="${project_name}/chat/session-secret"
if aws secretsmanager describe-secret --secret-id "${secret_name}" >/dev/null 2>&1; then
  echo "Chat session secret already exists; it was not rotated."
  exit 0
fi

secret_file="$(mktemp)"
trap 'rm -f "${secret_file}"' EXIT
chmod 0600 "${secret_file}"
openssl rand -base64 48 | tr -d '\n' >"${secret_file}"

aws secretsmanager create-secret \
  --name "${secret_name}" \
  --description "Encryption key for the Verify chatbot session cookie; never placed in Terraform state" \
  --secret-string "file://${secret_file}" >/dev/null

echo "Chat session secret created in Secrets Manager."
