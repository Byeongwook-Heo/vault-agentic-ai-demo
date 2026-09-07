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
full_user="${DEMO_FULL_USER:-approved.user@example.com}"
limited_user="${DEMO_LIMITED_USER:-limited.user}"
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

full_orders="$(run_query "${full_credentials}" "SELECT string_agg(order_id, ', ' ORDER BY order_id) FROM v_bob_order_status_full;")"
limited_orders="$(run_query "${limited_credentials}" "SELECT string_agg(order_id, ', ' ORDER BY order_id) FROM v_bob_order_status_limited;")"
limited_sees_1002="$(run_query "${limited_credentials}" "SELECT EXISTS (SELECT 1 FROM v_bob_order_status_limited WHERE order_id = 'ORD-1002');")"
limited_sees_1003="$(run_query "${limited_credentials}" "SELECT EXISTS (SELECT 1 FROM v_bob_order_status_limited WHERE order_id = 'ORD-1003');")"

test "${full_orders}" = "ORD-1001, ORD-1002, ORD-1003, ORD-1004"
test "${limited_orders}" = "ORD-1001, ORD-1004"
test "${limited_sees_1002}" = "f"
test "${limited_sees_1003}" = "f"

full_view_denied="NO"
if ! run_query "${limited_credentials}" "SELECT 1 FROM v_bob_order_status_full LIMIT 1;" >/dev/null 2>&1; then
  full_view_denied="YES"
fi
test "${full_view_denied}" = "YES"

for lease_id in "${lease_ids[@]}"; do
  vault lease revoke "${lease_id}" >/dev/null
done
lease_ids=()

cat <<EOF
DEMO_ACCESS_REPORT_BEGIN

Access Control Demo Report
────────────────────────────────────────────────────────

[승인된 전체 사용자]
User        : ${full_user}
Access tier : orders-full
Vault role  : bob-orders-full
조회 주문   : ${full_orders}

[승인된 제한 사용자]
User        : ${limited_user}
Access tier : orders-limited
Vault role  : bob-orders-limited
조회 주문   : ${limited_orders}
숨김 주문   : ORD-1002, ORD-1003
전체 뷰 차단: ${full_view_denied}

Result      : PASS
Lease 폐기  : YES
비밀값 출력 : NO

DEMO_ACCESS_REPORT_END
EOF
