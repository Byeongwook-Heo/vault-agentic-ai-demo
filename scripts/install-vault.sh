#!/usr/bin/env bash
set -euo pipefail
set +x

vault_version="${VAULT_VERSION:-${BOOTSTRAP_VAULT_VERSION:-2.1.0+ent}}"
archive="vault_${vault_version}_linux_amd64.zip"
expected_version_prefix="Vault v${vault_version}"
base_url="https://releases.hashicorp.com/vault/${vault_version}"
cache_bucket="${BOOTSTRAP_VAULT_CACHE_BUCKET:-${ARTIFACT_BUCKET:-}}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
embedded_binary="${script_dir}/vendor/vault/vault"
cache_key="vendor/vault/${archive}"
cache_checksum_key="vendor/vault/vault_${vault_version}_SHA256SUMS"
work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT

if command -v vault >/dev/null 2>&1; then
  installed="$(vault version 2>/dev/null || true)"
  if [[ "${installed}" == ${expected_version_prefix}* ]]; then
    echo "Vault ${vault_version} already available; skipping download."
    exit 0
  fi
fi

if [[ -x "${embedded_binary}" ]]; then
  echo "Using embedded Vault binary."
  install -m 0755 "${embedded_binary}" /usr/local/bin/vault
  vault version
  exit 0
fi


curl_with_retry() {
  local url="$1"
  local out_file="$2"
  echo "Downloading ${url}"
  if [[ "${url}" == s3://* ]]; then
    if ! command -v aws >/dev/null 2>&1; then
      echo "AWS CLI not found for S3 fallback: ${url}" >&2
      return 1
    fi
    aws --version || true
    echo "Using AWS CLI for artifact download."
    aws s3 cp "${url}" "${out_file}"
    return 0
  fi
  curl \
    --fail \
    --silent \
    --show-error \
    --location \
    --connect-timeout 15 \
    --max-time 90 \
    --retry 2 \
    --retry-delay 3 \
    --retry-all-errors \
    "${url}" \
    --output "${out_file}"
}

download_artifact() {
  local local_file="$1"
  shift
  local allow_public_fallback="${VAULT_INSTALL_ALLOW_PUBLIC_FALLBACK:-false}"
  for candidate in "$@"; do
    if curl_with_retry "${candidate}" "${local_file}"; then
      return 0
    fi
    if [[ "${candidate}" != s3://* && "${allow_public_fallback}" != "true" ]]; then
      echo "Public download fallback disabled; giving up." >&2
      return 1
    fi
    echo "WARN: failed to download ${candidate}, trying next source." >&2
  done
  return 1
}

download_artifact "${work_dir}/${archive}" \
  "s3://${cache_bucket}/${cache_key}" \
  "${base_url}/${archive}"

download_artifact "${work_dir}/SHA256SUMS" \
  "s3://${cache_bucket}/${cache_checksum_key}" \
  "${base_url}/vault_${vault_version}_SHA256SUMS"

expected_sum="$(awk -v file="${archive}" '($2 == file) {print $1}' "${work_dir}/SHA256SUMS" || true)"
if [[ -z "${expected_sum}" ]]; then
  echo "Unable to find checksum for ${archive}." >&2
  exit 1
fi
actual_sum="$(sha256sum "${work_dir}/${archive}" | awk '{print $1}')"
if [[ "${expected_sum}" != "${actual_sum}" ]]; then
  echo "Checksum mismatch for ${archive}." >&2
  echo "  expected: ${expected_sum}" >&2
  echo "  actual:   ${actual_sum}" >&2
  exit 1
fi

(
  cd "${work_dir}"
)
unzip -q "${work_dir}/${archive}" -d "${work_dir}"
install -m 0755 "${work_dir}/vault" /usr/local/bin/vault
vault version
