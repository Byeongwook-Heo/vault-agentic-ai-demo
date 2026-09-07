#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/common.sh"

export VERIFY_TOKEN_URL VERIFY_JWKS_URL VERIFY_ISSUER VERIFY_AUDIENCE
export VERIFY_CLIENT_ID VERIFY_SCOPE VERIFY_NHI_CLAIM VERIFY_NHI_VALUE VERIFY_KMS_KEY_ID
VERIFY_TOKEN_URL="$(parameter_value "/${PROJECT_NAME}/verify/token-url")"
VERIFY_JWKS_URL="$(parameter_value "/${PROJECT_NAME}/verify/jwks-url")"
VERIFY_ISSUER="$(parameter_value "/${PROJECT_NAME}/verify/issuer")"
VERIFY_AUDIENCE="$(parameter_value "/${PROJECT_NAME}/verify/audience")"
VERIFY_CLIENT_ID="$(parameter_value "/${PROJECT_NAME}/verify/client-id")"
VERIFY_SCOPE="$(parameter_value "/${PROJECT_NAME}/verify/scope")"
VERIFY_NHI_CLAIM="$(parameter_value "/${PROJECT_NAME}/verify/nhi-claim")"
VERIFY_NHI_VALUE="$(parameter_value "/${PROJECT_NAME}/verify/nhi-value")"
VERIFY_KMS_KEY_ID="alias/${PROJECT_NAME}-verify-signing"

node "${script_dir}/verify-preflight.mjs"
