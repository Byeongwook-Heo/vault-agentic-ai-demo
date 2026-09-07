#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/aws-credentials.sh"
load_demo_aws_credentials

: "${VERIFY_TOKEN_URL:?Set VERIFY_TOKEN_URL}"
: "${VERIFY_JWKS_URL:?Set VERIFY_JWKS_URL}"
: "${VERIFY_ISSUER:?Set VERIFY_ISSUER}"
: "${VERIFY_AUDIENCE:?Set VERIFY_AUDIENCE}"
: "${VERIFY_CLIENT_ID:?Set VERIFY_CLIENT_ID}"
: "${VERIFY_NHI_VALUE:?Set VERIFY_NHI_VALUE}"

for url in "${VERIFY_TOKEN_URL}" "${VERIFY_JWKS_URL}" "${VERIFY_ISSUER}"; do
  [[ "${url}" =~ ^https:// ]] || {
    echo "IBM Verify URLs must use HTTPS." >&2
    exit 2
  }
done

project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
put_parameter() {
  local name="$1"
  local value="$2"
  aws ssm put-parameter \
    --name "/${project_name}/verify/${name}" \
    --type String \
    --overwrite \
    --value "${value}" >/dev/null
}

put_parameter token-url "${VERIFY_TOKEN_URL}"
put_parameter jwks-url "${VERIFY_JWKS_URL}"
put_parameter issuer "${VERIFY_ISSUER}"
put_parameter audience "${VERIFY_AUDIENCE}"
put_parameter client-id "${VERIFY_CLIENT_ID}"
put_parameter scope "${VERIFY_SCOPE:-openid}"
put_parameter nhi-claim "${VERIFY_NHI_CLAIM:-sub}"
put_parameter nhi-value "${VERIFY_NHI_VALUE}"

echo "IBM Verify public client metadata stored in project-scoped parameters."
