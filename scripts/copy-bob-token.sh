#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/aws-credentials.sh"
load_demo_aws_credentials

command -v pbcopy >/dev/null 2>&1 || {
  echo "pbcopy is required on macOS." >&2
  exit 1
}

project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
aws secretsmanager get-secret-value \
  --secret-id "${project_name}/mcp/transport-token" \
  --query SecretString \
  --output text | tr -d '\n' | pbcopy

echo "The MCP transport token was copied to the clipboard and was not printed."
