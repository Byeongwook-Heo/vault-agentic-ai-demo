#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 1 || ! "$1" =~ ^(plan|apply)$ ]]; then
  echo "usage: $0 <plan|apply>" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/common.sh"

export PROJECT_NAME AWS_REGION VERIFY_TOKEN_URL VERIFY_ISSUER
export VERIFY_CLIENT_ID VERIFY_KMS_KEY_ID
VERIFY_TOKEN_URL="$(parameter_value "/${PROJECT_NAME}/verify/token-url")"
VERIFY_ISSUER="$(parameter_value "/${PROJECT_NAME}/verify/issuer")"
VERIFY_CLIENT_ID="$(parameter_value "/${PROJECT_NAME}/verify/client-id")"
VERIFY_KMS_KEY_ID="alias/${PROJECT_NAME}-verify-signing"

node "${script_dir}/verify-client-enable-jwt.mjs" "$1"
