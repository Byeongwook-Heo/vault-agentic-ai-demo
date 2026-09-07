#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/common.sh"

master_secret_arn="$(parameter_value "/${PROJECT_NAME}/rds/master-secret-arn")"
master_secret="$(aws secretsmanager get-secret-value \
  --secret-id "${master_secret_arn}" \
  --query SecretString \
  --output text)"
db_host="$(parameter_value "/${PROJECT_NAME}/rds/endpoint")"
db_name="$(parameter_value "/${PROJECT_NAME}/rds/database")"
master_user="$(printf '%s' "${master_secret}" | jq -er '.username')"
master_password="$(printf '%s' "${master_secret}" | jq -er '.password')"
rds_ca="$(download_rds_ca)"
vault_admin_password="$(openssl rand -base64 36 | tr -d '\n')"

PGPASSWORD="${master_password}" PGSSLMODE=verify-full PGSSLROOTCERT="${rds_ca}" \
  psql --host="${db_host}" --port=5432 --username="${master_user}" --dbname="${db_name}" \
  --no-password --set=ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS orders (
  order_id varchar(40) PRIMARY KEY,
  customer_id varchar(40) NOT NULL,
  payment_status varchar(40) NOT NULL,
  delivery_status varchar(40) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_history (
  history_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id varchar(40) NOT NULL,
  event_name varchar(80) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  customer_id varchar(40) PRIMARY KEY,
  synthetic_label varchar(80) NOT NULL,
  contact_reference varchar(80) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id varchar(40) NOT NULL,
  payment_status varchar(40) NOT NULL,
  synthetic_reference varchar(80) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO customers (customer_id, synthetic_label, contact_reference) VALUES
  ('CUS-1001', 'Synthetic Customer 1001', 'synthetic-1001@example.invalid'),
  ('CUS-1002', 'Synthetic Customer 1002', 'synthetic-1002@example.invalid'),
  ('CUS-1003', 'Synthetic Customer 1003', 'synthetic-1003@example.invalid')
ON CONFLICT (customer_id) DO NOTHING;

INSERT INTO orders (order_id, customer_id, payment_status, delivery_status, updated_at) VALUES
  ('ORD-1001', 'CUS-1001', 'PAID', 'PREPARING', now() - interval '12 minutes'),
  ('ORD-1002', 'CUS-1002', 'FAILED', 'CANCELLED', now() - interval '48 minutes'),
  ('ORD-1003', 'CUS-1003', 'PAID', 'SHIPPED', now() - interval '2 hours'),
  ('ORD-1004', 'CUS-1001', 'FAILED', 'ON_HOLD', now() - interval '4 hours')
ON CONFLICT (order_id) DO UPDATE
SET payment_status = EXCLUDED.payment_status,
    delivery_status = EXCLUDED.delivery_status,
    updated_at = EXCLUDED.updated_at;

CREATE OR REPLACE VIEW v_bob_order_status_full AS
SELECT order_id, payment_status, delivery_status, updated_at
FROM orders;

CREATE OR REPLACE VIEW v_bob_order_status_limited AS
SELECT order_id, payment_status, delivery_status, updated_at
FROM orders
WHERE customer_id = 'CUS-1001';

CREATE OR REPLACE VIEW v_bob_order_status AS
SELECT order_id, payment_status, delivery_status, updated_at
FROM v_bob_order_status_full;

SELECT 'CREATE ROLE bob_orders_full_reader NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bob_orders_full_reader') \gexec
SELECT 'CREATE ROLE bob_orders_limited_reader NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bob_orders_limited_reader') \gexec
GRANT CONNECT ON DATABASE shop_demo TO bob_orders_full_reader, bob_orders_limited_reader;
GRANT USAGE ON SCHEMA public TO bob_orders_full_reader, bob_orders_limited_reader;
GRANT SELECT ON v_bob_order_status_full TO bob_orders_full_reader;
GRANT SELECT ON v_bob_order_status_limited TO bob_orders_limited_reader;
REVOKE ALL ON v_bob_order_status_full FROM bob_orders_limited_reader;
REVOKE ALL ON v_bob_order_status_limited FROM bob_orders_full_reader;

SQL

admin_sql="$(new_private_file)"
printf "\\set vault_admin_password '%s'\n" "${vault_admin_password}" >"${admin_sql}"
cat >>"${admin_sql}" <<'SQL'
SELECT 'CREATE ROLE vault_db_admin LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vault_db_admin') \gexec
ALTER ROLE vault_db_admin WITH LOGIN CREATEROLE PASSWORD :'vault_admin_password';
GRANT bob_orders_full_reader TO vault_db_admin WITH ADMIN OPTION;
GRANT bob_orders_limited_reader TO vault_db_admin WITH ADMIN OPTION;
SQL
PGPASSWORD="${master_password}" PGSSLMODE=verify-full PGSSLROOTCERT="${rds_ca}" \
  psql --host="${db_host}" --port=5432 --username="${master_user}" --dbname="${db_name}" \
  --no-password --set=ON_ERROR_STOP=1 --file="${admin_sql}"

bootstrap_secret_file="$(new_private_file)"
jq -cn \
  --arg username "vault_db_admin" \
  --arg password "${vault_admin_password}" \
  --arg host "${db_host}" \
  --arg database "${db_name}" \
  '{username:$username,password:$password,host:$host,database:$database}' \
  >"${bootstrap_secret_file}"

secret_name="${PROJECT_NAME}/bootstrap/vault-db-admin"
if aws secretsmanager get-secret-value \
  --secret-id "${secret_name}" \
  --query ARN \
  --output text >/dev/null 2>&1; then
  aws secretsmanager put-secret-value \
    --secret-id "${secret_name}" \
    --secret-string "file://${bootstrap_secret_file}" >/dev/null
else
  aws secretsmanager create-secret \
    --name "${secret_name}" \
    --description "Temporary Vault database bootstrap credential; invalidated after root rotation" \
    --secret-string "file://${bootstrap_secret_file}" >/dev/null
fi

echo "Synthetic order data and least-privilege database roles are ready."
