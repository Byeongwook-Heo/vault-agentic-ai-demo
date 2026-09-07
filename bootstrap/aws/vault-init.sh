#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/common.sh"

prepare_vault_environment
wait_for_vault

status_json="$(vault status -format=json 2>/dev/null || true)"
if [[ "$(printf '%s' "${status_json}" | jq -r '.initialized // false')" == "true" ]]; then
  echo "Vault is already initialized; recovery material was not changed."
  exit 0
fi

init_file="$(new_private_file)"
vault operator init \
  -format=json \
  -recovery-shares=1 \
  -recovery-threshold=1 >"${init_file}"

jq -e '.root_token and (.recovery_keys_b64 | length == 1)' "${init_file}" >/dev/null
aws secretsmanager put-secret-value \
  --secret-id "${PROJECT_NAME}/vault/recovery" \
  --secret-string "file://${init_file}" >/dev/null

echo "Vault initialized with KMS auto-unseal; recovery material is stored only in Secrets Manager."
