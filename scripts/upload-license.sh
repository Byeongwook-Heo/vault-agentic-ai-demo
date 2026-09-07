#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/aws-credentials.sh"
load_demo_aws_credentials

project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
license_file="${VAULT_LICENSE_FILE:?Set VAULT_LICENSE_FILE to your Vault Enterprise license file}"
test -s "${license_file}"

aws ssm put-parameter \
  --name "/${project_name}/lab/vault/license" \
  --description "Vault Enterprise demo license" \
  --type SecureString \
  --overwrite \
  --value "file://${license_file}" >/dev/null

echo "Vault license uploaded to the project-specific encrypted parameter."
