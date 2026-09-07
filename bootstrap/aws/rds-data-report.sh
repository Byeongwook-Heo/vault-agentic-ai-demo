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
credentials_file="$(new_private_file)"
lease_id=""

cleanup() {
  if [[ -n "${lease_id}" ]]; then
    vault lease revoke "${lease_id}" >/dev/null 2>&1 || true
  fi
  cleanup_bootstrap_files
}
trap cleanup EXIT

vault read -format=json "database/creds/bob-orders-full" >"${credentials_file}"
lease_id="$(jq -er '.lease_id' "${credentials_file}")"
db_username="$(jq -er '.data.username' "${credentials_file}")"
db_password="$(jq -er '.data.password' "${credentials_file}")"

query_result="$(
  PGPASSWORD="${db_password}" PGSSLMODE=verify-full PGSSLROOTCERT="${rds_ca}" \
    psql --host="${db_host}" --port=5432 --username="${db_username}" \
      --dbname="${db_name}" --no-password --set=ON_ERROR_STOP=1 \
      --pset=pager=off --pset=border=1 \
      --command="
        SELECT
          order_id,
          payment_status,
          delivery_status,
          to_char(updated_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') AS updated_at_kst
        FROM v_bob_order_status_full
        ORDER BY order_id;
      "
)"

vault lease revoke "${lease_id}" >/dev/null
lease_id=""

cat <<EOF
RDS_DATA_REPORT_BEGIN

RDS Read-only Data Report
────────────────────────────────────────────────────────────────────────

Database     : ${db_name}
Vault role  : bob-orders-full
Source view : v_bob_order_status_full

${query_result}

Result      : PASS
Lease 폐기  : YES
비밀값 출력 : NO

RDS_DATA_REPORT_END
EOF
