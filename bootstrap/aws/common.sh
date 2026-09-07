#!/usr/bin/env bash
set -euo pipefail
umask 077

PROJECT_NAME="${PROJECT_NAME:-bob-vault-nhi-demo}"
AWS_REGION="${AWS_REGION:-ap-northeast-2}"
export AWS_REGION AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-${AWS_REGION}}"

temporary_files=()
cleanup_bootstrap_files() {
  if ((${#temporary_files[@]} > 0)); then
    rm -f "${temporary_files[@]}"
  fi
}
trap cleanup_bootstrap_files EXIT

new_private_file() {
  local file
  file="$(mktemp)"
  chmod 0600 "${file}"
  temporary_files+=("${file}")
  printf '%s' "${file}"
}

parameter_value() {
  aws ssm get-parameter \
    --name "$1" \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text
}

prepare_vault_environment() {
  local ca_file
  ca_file="$(new_private_file)"
  parameter_value "/${PROJECT_NAME}/vault/ca-pem" >"${ca_file}"
  export VAULT_ADDR
  export VAULT_CACERT="${ca_file}"
  VAULT_ADDR="$(parameter_value "/${PROJECT_NAME}/vault/address")"
}

load_vault_root_token() {
  local recovery_secret
  recovery_secret="$(aws secretsmanager get-secret-value \
    --secret-id "${PROJECT_NAME}/vault/recovery" \
    --query SecretString \
    --output text)"
  export VAULT_TOKEN
  VAULT_TOKEN="$(printf '%s' "${recovery_secret}" | jq -er '.root_token')"
}

wait_for_vault() {
  local attempt status_code curl_exit status_line
  local host port
  local max_attempts="${VAULT_WAIT_ATTEMPTS:-36}"
  local sleep_seconds="${VAULT_WAIT_SLEEP_SECONDS:-5}"
  local error_output
  local -i port_number

  host="$(printf '%s' "${VAULT_ADDR}" | sed -E 's#^https?://##' | cut -d'/' -f1 | cut -d':' -f1)"
  port_number=8200
  if printf '%s' "${VAULT_ADDR}" | grep -q ':'; then
    port_number="$(printf '%s' "${VAULT_ADDR}" | sed -E 's#^https?://##' | cut -d'/' -f1 | awk -F: '{print $2}')"
  fi

  echo "Checking Vault reachability (${max_attempts} attempts, ${sleep_seconds}s interval)"
  echo "  endpoint: ${VAULT_ADDR}"
  echo "  host: ${host} (${port_number})"

  for attempt in $(seq 1 "${max_attempts}"); do
    error_output="$(mktemp)"
    status_code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
      --cacert "${VAULT_CACERT}" --connect-timeout 3 --max-time 8 \
      "${VAULT_ADDR}/v1/sys/health" 2>"${error_output}" || true)"
    curl_exit=$?
    status_line="$(tr -d '\n' < "${error_output}")"
    rm -f "${error_output}"

    if [[ "${status_code}" =~ ^(200|429|472|473|501|503)$ ]]; then
      return 0
    fi

    if (( curl_exit != 0 )); then
      echo "Attempt ${attempt}/${max_attempts}: curl failed (${curl_exit}) for ${VAULT_ADDR}"
      [[ -n "${status_line}" ]] && echo "  $status_line"
      if [[ "${status_line}" == *"Could not resolve host"* ]]; then
        echo "  Hostname resolution failure (DNS). Verify Route53 private-hosted-zone association for ${host}."
      fi
    else
      echo "Attempt ${attempt}/${max_attempts}: Vault returned HTTP ${status_code}"
    fi
    if (( attempt < max_attempts )); then
      sleep "${sleep_seconds}"
    fi
  done
  echo "Vault did not become reachable." >&2
  echo "Tip: if this is inside CodeBuild, verify build VPC network (subnet + SG), Route53 private zone binding, and Vault SG ingress on TCP 8200 from ${host} path." >&2
  return 1
}

download_rds_ca() {
  local ca_file
  ca_file="$(new_private_file)"
  curl --fail --silent --show-error --location \
    "https://truststore.pki.rds.amazonaws.com/${AWS_REGION}/${AWS_REGION}-bundle.pem" \
    --output "${ca_file}"
  openssl crl2pkcs7 -nocrl -certfile "${ca_file}" \
    | openssl pkcs7 -print_certs -noout >/dev/null
  printf '%s' "${ca_file}"
}
