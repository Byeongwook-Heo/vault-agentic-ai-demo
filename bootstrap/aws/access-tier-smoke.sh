#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/common.sh"

prepare_vault_environment
wait_for_vault
load_vault_root_token
export VAULT_NAMESPACE="demo"

db_host="$(parameter_value "/${PROJECT_NAME}/rds/endpoint")"
db_name="$(parameter_value "/${PROJECT_NAME}/rds/database")"
rds_ca="$(download_rds_ca)"
lease_ids=()

cleanup() {
  local lease_id
  for lease_id in "${lease_ids[@]}"; do
    vault lease revoke "${lease_id}" >/dev/null 2>&1 || true
  done
  cleanup_bootstrap_files
}
trap cleanup EXIT

issue_credentials() {
  local role="$1"
  local output_file="$2"
  local lease_id

  vault read -format=json "database/creds/${role}" >"${output_file}"
  lease_id="$(jq -er '.lease_id' "${output_file}")"
  jq -er '.data.username | length > 0' "${output_file}" >/dev/null
  jq -er '.data.password | length > 0' "${output_file}" >/dev/null
  lease_ids+=("${lease_id}")
}

run_query() {
  local credential_file="$1"
  local query="$2"
  local username password

  username="$(jq -er '.data.username' "${credential_file}")"
  password="$(jq -er '.data.password' "${credential_file}")"
  PGPASSWORD="${password}" PGSSLMODE=verify-full PGSSLROOTCERT="${rds_ca}" \
    psql --host="${db_host}" --port=5432 --username="${username}" \
    --dbname="${db_name}" --no-password --tuples-only --no-align \
    --set=ON_ERROR_STOP=1 --command="${query}"
}

full_credentials="$(new_private_file)"
limited_credentials="$(new_private_file)"
issue_credentials bob-orders-full "${full_credentials}"
issue_credentials bob-orders-limited "${limited_credentials}"

test "$(run_query "${full_credentials}" "SELECT EXISTS (SELECT 1 FROM v_bob_order_status_full WHERE order_id = 'ORD-1002');")" = "t"
test "$(run_query "${limited_credentials}" "SELECT EXISTS (SELECT 1 FROM v_bob_order_status_limited WHERE order_id = 'ORD-1001');")" = "t"
test "$(run_query "${limited_credentials}" "SELECT EXISTS (SELECT 1 FROM v_bob_order_status_limited WHERE order_id = 'ORD-1002');")" = "f"

if run_query "${limited_credentials}" "SELECT 1 FROM v_bob_order_status_full LIMIT 1;" >/dev/null 2>&1; then
  echo "Limited database role unexpectedly read the full-order view." >&2
  exit 1
fi
if run_query "${full_credentials}" "SELECT 1 FROM v_bob_order_status_limited LIMIT 1;" >/dev/null 2>&1; then
  echo "Full database role unexpectedly read the limited-order view." >&2
  exit 1
fi

echo "Vault dynamic credentials and PostgreSQL access-tier isolation passed."
