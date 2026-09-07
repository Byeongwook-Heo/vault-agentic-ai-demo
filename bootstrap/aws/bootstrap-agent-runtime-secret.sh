#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-northeast-2}"
PROJECT_NAME="${PROJECT_NAME:-bob-vault-nhi-demo}"
SECRET_NAME="${PROJECT_NAME}/chat/agent-runtime-token"

if [[ -z "${AGENT_RUNTIME_TOKEN:-}" ]] || [[ "${#AGENT_RUNTIME_TOKEN}" -lt 16 ]]; then
  echo "AGENT_RUNTIME_TOKEN must be set and at least 16 characters." >&2
  exit 2
fi

if aws secretsmanager describe-secret \
  --region "${AWS_REGION}" \
  --secret-id "${SECRET_NAME}" >/dev/null 2>&1; then
  aws secretsmanager put-secret-value \
    --region "${AWS_REGION}" \
    --secret-id "${SECRET_NAME}" \
    --secret-string "${AGENT_RUNTIME_TOKEN}" >/dev/null
else
  aws secretsmanager create-secret \
    --region "${AWS_REGION}" \
    --name "${SECRET_NAME}" \
    --description "Private agent planning runtime token" \
    --secret-string "${AGENT_RUNTIME_TOKEN}" >/dev/null
fi

echo "Private agent planning runtime token stored in Secrets Manager."
