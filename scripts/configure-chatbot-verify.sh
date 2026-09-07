#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/aws-credentials.sh"
load_demo_aws_credentials

: "${VERIFY_USER_AUTHORIZATION_URL:?Set VERIFY_USER_AUTHORIZATION_URL}"
: "${VERIFY_USER_TOKEN_URL:?Set VERIFY_USER_TOKEN_URL}"
: "${VERIFY_USER_JWKS_URL:?Set VERIFY_USER_JWKS_URL}"
: "${VERIFY_USER_ISSUER:?Set VERIFY_USER_ISSUER}"
: "${VERIFY_USER_CLIENT_ID:?Set VERIFY_USER_CLIENT_ID}"
: "${VERIFY_OBO_TOKEN_URL:?Set VERIFY_OBO_TOKEN_URL}"
: "${VERIFY_OBO_JWKS_URL:?Set VERIFY_OBO_JWKS_URL}"
: "${VERIFY_OBO_ISSUER:?Set VERIFY_OBO_ISSUER}"
: "${VERIFY_OBO_AUDIENCE:?Set VERIFY_OBO_AUDIENCE}"
: "${VERIFY_OBO_CLIENT_ID:?Set VERIFY_OBO_CLIENT_ID}"

for url in \
  "${VERIFY_USER_AUTHORIZATION_URL}" \
  "${VERIFY_USER_TOKEN_URL}" \
  "${VERIFY_USER_JWKS_URL}" \
  "${VERIFY_USER_ISSUER}" \
  "${VERIFY_OBO_TOKEN_URL}" \
  "${VERIFY_OBO_JWKS_URL}" \
  "${VERIFY_OBO_ISSUER}"; do
  [[ "${url}" =~ ^https:// ]] || {
    echo "IBM Verify URLs must use HTTPS." >&2
    exit 2
  }
done

project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
put_parameter() {
  local path="$1"
  local value="$2"
  aws ssm put-parameter \
    --name "/${project_name}/verify/${path}" \
    --type String \
    --overwrite \
    --value "${value}" >/dev/null
}

put_parameter user/authorization-url "${VERIFY_USER_AUTHORIZATION_URL}"
put_parameter user/token-url "${VERIFY_USER_TOKEN_URL}"
put_parameter user/jwks-url "${VERIFY_USER_JWKS_URL}"
put_parameter user/issuer "${VERIFY_USER_ISSUER}"
put_parameter user/audience "${VERIFY_USER_AUDIENCE:-${VERIFY_USER_CLIENT_ID}}"
put_parameter user/client-id "${VERIFY_USER_CLIENT_ID}"
put_parameter user/scopes "${VERIFY_USER_SCOPES:-openid profile vault.db.read}"

put_parameter obo/token-url "${VERIFY_OBO_TOKEN_URL}"
put_parameter obo/jwks-url "${VERIFY_OBO_JWKS_URL}"
put_parameter obo/issuer "${VERIFY_OBO_ISSUER}"
put_parameter obo/audience "${VERIFY_OBO_AUDIENCE}"
put_parameter obo/client-id "${VERIFY_OBO_CLIENT_ID}"
put_parameter obo/scope "${VERIFY_OBO_SCOPE:-vault.db.read}"
put_parameter obo/actor-claim "${VERIFY_OBO_ACTOR_CLAIM:-client_id}"
put_parameter obo/actor-value "${VERIFY_OBO_ACTOR_VALUE:-${VERIFY_OBO_CLIENT_ID}}"

echo "IBM Verify user-login and OBO metadata stored in project-scoped parameters."
