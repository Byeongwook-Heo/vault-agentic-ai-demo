#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/aws-credentials.sh"
load_demo_aws_credentials

project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
base_url="${DEMO_URL:-https://bob-vault-demo.demo.example.com}"
status_json="$(curl --fail --silent --show-error "${base_url}/api/status")"
curl --fail --silent --show-error "${base_url}/readyz" >/dev/null

if [[ "$(printf '%s' "${status_json}" | jq -r '.chatbot.enabled')" == "true" ]]; then
  login_status="$(curl --silent --show-error \
    --output /dev/null \
    --write-out '%{http_code}' \
    "${base_url}/auth/login")"
  test "${login_status}" = "302"

  session_json="$(curl --fail --silent --show-error \
    "${base_url}/api/me")"
  test "$(printf '%s' "${session_json}" | jq -r '.authenticated')" = "false"
  test "$(printf '%s' "${session_json}" | jq -r '.authorization')" = "unapproved"

  public_chat_json="$(curl --fail --silent --show-error \
    --header "accept: application/json" \
    --header "content-type: application/json" \
    --data '{"message":"이 Lab의 보안 흐름을 설명해줘"}' \
    "${base_url}/api/chat")"
  test "$(printf '%s' "${public_chat_json}" | jq -r '.tool')" = "null"

  protected_chat_json="$(curl --fail --silent --show-error \
    --header "accept: application/json" \
    --header "content-type: application/json" \
    --data '{"message":"주문 ORD-1001 상태를 확인해줘"}' \
    "${base_url}/api/chat")"
  test "$(printf '%s' "${protected_chat_json}" | jq -r '[.trace[].status] | any(. == "denied")')" = "true"
  test "$(printf '%s' "${protected_chat_json}" | jq -r '.credential // "not-issued"')" = "not-issued"

  mcp_status="$(curl --silent --show-error \
    --output /dev/null \
    --write-out '%{http_code}' \
    --header "accept: application/json, text/event-stream" \
    --header "content-type: application/json" \
    --data '{"jsonrpc":"2.0","id":"smoke-1","method":"tools/list","params":{}}' \
    "${base_url}/mcp")"
  test "${mcp_status}" = "401"
  echo "Public chatbot, Verify login redirect, protected-data deny, and MCP authentication checks passed."
  exit 0
fi

transport_token="$(aws secretsmanager get-secret-value \
  --secret-id "${project_name}/mcp/transport-token" \
  --query SecretString \
  --output text)"

response_file="$(mktemp)"
trap 'rm -f "${response_file}"' EXIT
chmod 0600 "${response_file}"
http_status="$(curl --silent --show-error \
  --output "${response_file}" \
  --write-out '%{http_code}' \
  --header "authorization: Bearer ${transport_token}" \
  --header "accept: application/json, text/event-stream" \
  --header "content-type: application/json" \
  --data '{"jsonrpc":"2.0","id":"smoke-1","method":"tools/list","params":{}}' \
  "${base_url}/mcp")"
test "${http_status}" = "200"
jq -e '.result.tools | map(.name) | sort == ["get_failed_payment_summary","get_order_status","get_sensitive_payment_data"]' "${response_file}" >/dev/null

echo "Public health and authenticated MCP tool discovery passed."
