#!/usr/bin/env bash
set -euo pipefail
set +x
set -o errtrace
trap 'echo "vault-bootstrap.sh failed at line ${LINENO}" >&2' ERR

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/common.sh"

access_tier_enforcement="${ACCESS_TIER_ENFORCEMENT:-enforce}"
access_tier_claim="${VERIFY_ACCESS_TIER_CLAIM:-access_tier}"
access_tier_full_value="${VERIFY_ACCESS_TIER_FULL_VALUE:-orders-full}"
access_tier_limited_value="${VERIFY_ACCESS_TIER_LIMITED_VALUE:-orders-limited}"
case "${access_tier_enforcement}" in
  off|audit|enforce) ;;
  *)
    echo "ACCESS_TIER_ENFORCEMENT must be off, audit, or enforce." >&2
    exit 2
    ;;
esac

prepare_vault_environment
wait_for_vault
load_vault_root_token

if aws ssm get-parameter \
  --name "/${PROJECT_NAME}/verify/obo/token-url" >/dev/null 2>&1; then
  verify_jwks_url="$(parameter_value "/${PROJECT_NAME}/verify/obo/jwks-url")"
  verify_issuer="$(parameter_value "/${PROJECT_NAME}/verify/obo/issuer")"
  verify_audience="$(parameter_value "/${PROJECT_NAME}/verify/obo/audience")"
  verify_user_claim="sub"
  verify_bound_claim="$(parameter_value "/${PROJECT_NAME}/verify/obo/actor-claim")"
  verify_bound_value="$(parameter_value "/${PROJECT_NAME}/verify/obo/actor-value")"
  identity_flow="obo"
else
  verify_jwks_url="$(parameter_value "/${PROJECT_NAME}/verify/jwks-url")"
  verify_issuer="$(parameter_value "/${PROJECT_NAME}/verify/issuer")"
  verify_audience="$(parameter_value "/${PROJECT_NAME}/verify/audience")"
  verify_user_claim="$(parameter_value "/${PROJECT_NAME}/verify/nhi-claim")"
  verify_bound_claim="${verify_user_claim}"
  verify_bound_value="$(parameter_value "/${PROJECT_NAME}/verify/nhi-value")"
  identity_flow="client_credentials"
fi

unset VAULT_NAMESPACE
if ! vault namespace lookup demo >/dev/null 2>&1; then
  vault namespace create demo >/dev/null
fi
if ! vault audit list -format=json | jq -e 'has("file/")' >/dev/null; then
  vault audit enable file file_path=/var/log/vault/audit.log >/dev/null
fi

export VAULT_NAMESPACE="demo"
if ! vault auth list -format=json | jq -e 'has("jwt/")' >/dev/null; then
  vault auth enable -path=jwt jwt >/dev/null
fi
if ! vault secrets list -format=json | jq -e 'has("database/")' >/dev/null; then
  vault secrets enable -path=database database >/dev/null
fi

full_policy_file="$(new_private_file)"
cat >"${full_policy_file}" <<'HCL'
path "database/creds/bob-orders-full" {
  capabilities = ["read"]
}
HCL
vault policy write bob-orders-full "${full_policy_file}" >/dev/null

limited_policy_file="$(new_private_file)"
cat >"${limited_policy_file}" <<'HCL'
path "database/creds/bob-orders-limited" {
  capabilities = ["read"]
}
HCL
vault policy write bob-orders-limited "${limited_policy_file}" >/dev/null

vault write auth/jwt/config \
  jwks_url="${verify_jwks_url}" \
  bound_issuer="${verify_issuer}" \
  jwt_supported_algs=RS256 \
  default_role=bob-orders-full >/dev/null

write_tier_role() {
  local role_name="$1"
  local policy_name="$2"
  local tier_value="$3"
  local role_file
  role_file="$(new_private_file)"
  jq -n \
    --arg user_claim "${verify_user_claim}" \
    --arg audience "${verify_audience}" \
    --arg actor_claim "${verify_bound_claim}" \
    --arg actor_value "${verify_bound_value}" \
    --arg tier_claim "${access_tier_claim}" \
    --arg tier_value "${tier_value}" \
    --arg mode "${access_tier_enforcement}" \
    --arg policy "${policy_name}" \
    '{
      role_type: "jwt",
      user_claim: $user_claim,
      bound_audiences: [$audience],
      bound_claims: (
        {($actor_claim): $actor_value} +
        (if $mode == "enforce" then {($tier_claim): $tier_value} else {} end)
      ),
      token_policies: [$policy],
      token_no_default_policy: true,
      token_ttl: "2m",
      token_max_ttl: "5m",
      token_explicit_max_ttl: "5m"
    }' >"${role_file}"
  vault write "auth/jwt/role/${role_name}" - <"${role_file}" >/dev/null
}

write_tier_role bob-orders-full bob-orders-full "${access_tier_full_value}"
write_tier_role bob-orders-limited bob-orders-limited "${access_tier_limited_value}"

bootstrap_secret_name="${PROJECT_NAME}/bootstrap/vault-db-admin"
bootstrap_secret_available=false
db_admin_secret=""
allowed_roles="bob-orders-full,bob-orders-limited"
if [[ "${access_tier_enforcement}" != "enforce" ]]; then
  allowed_roles+=",bob-orders-readonly"
fi
if db_admin_secret="$(aws secretsmanager get-secret-value \
  --secret-id "${bootstrap_secret_name}" \
  --query SecretString \
  --output text 2>/dev/null)"; then
  bootstrap_secret_available=true
fi

if [[ "${bootstrap_secret_available}" == "true" ]]; then
  db_username="$(printf '%s' "${db_admin_secret}" | jq -er '.username')"
  db_password="$(printf '%s' "${db_admin_secret}" | jq -er '.password')"
  db_host="$(printf '%s' "${db_admin_secret}" | jq -er '.host')"
  db_name="$(printf '%s' "${db_admin_secret}" | jq -er '.database')"

  vault write database/config/shop-postgres \
    plugin_name=postgresql-database-plugin \
    allowed_roles="${allowed_roles}" \
    connection_url="postgresql://{{username}}:{{password}}@${db_host}:5432/${db_name}?sslmode=verify-full&sslrootcert=/etc/vault.d/tls/rds-ca.pem" \
    username="${db_username}" \
    password="${db_password}" \
    verify_connection=true >/dev/null
elif vault read database/config/shop-postgres >/dev/null 2>&1; then
  echo "Existing PostgreSQL connection preserved; no bootstrap credential was supplied."
else
  echo "Vault database configuration and bootstrap credential are both missing." >&2
  exit 1
fi

full_creation_statements='CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '\''{{password}}'\'' VALID UNTIL '\''{{expiration}}'\''; GRANT bob_orders_full_reader TO "{{name}}";'
full_revocation_statements='REVOKE bob_orders_full_reader FROM "{{name}}"; DROP ROLE IF EXISTS "{{name}}";'
vault write database/roles/bob-orders-full \
  db_name=shop-postgres \
  creation_statements="${full_creation_statements}" \
  revocation_statements="${full_revocation_statements}" \
  default_ttl=2m \
  max_ttl=5m >/dev/null

limited_creation_statements='CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '\''{{password}}'\'' VALID UNTIL '\''{{expiration}}'\''; GRANT bob_orders_limited_reader TO "{{name}}";'
limited_revocation_statements='REVOKE bob_orders_limited_reader FROM "{{name}}"; DROP ROLE IF EXISTS "{{name}}";'
vault write database/roles/bob-orders-limited \
  db_name=shop-postgres \
  creation_statements="${limited_creation_statements}" \
  revocation_statements="${limited_revocation_statements}" \
  default_ttl=2m \
  max_ttl=5m >/dev/null

if [[ "${access_tier_enforcement}" == "enforce" ]]; then
  vault delete auth/jwt/role/bob-orders >/dev/null 2>&1 || true
  vault policy delete bob-orders >/dev/null 2>&1 || true
  vault delete database/roles/bob-orders-readonly >/dev/null 2>&1 || true
fi

if [[ "${bootstrap_secret_available}" == "true" ]]; then
  vault write -f database/rotate-root/shop-postgres >/dev/null
  aws secretsmanager delete-secret \
    --secret-id "${bootstrap_secret_name}" \
    --force-delete-without-recovery >/dev/null
fi

echo "Vault ${identity_flow} JWT access tiers are configured in ${access_tier_enforcement} mode."
