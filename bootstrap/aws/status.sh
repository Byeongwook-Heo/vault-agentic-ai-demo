#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/common.sh"

prepare_vault_environment
wait_for_vault

vault_status="$(vault status -format=json 2>/dev/null || true)"
initialized="$(printf '%s' "${vault_status}" | jq -r '.initialized // false')"
sealed="$(printf '%s' "${vault_status}" | jq -r 'if has("sealed") then .sealed else true end')"
echo "Vault reachable: yes"
echo "Vault initialized: ${initialized}"
echo "Vault sealed: ${sealed}"
