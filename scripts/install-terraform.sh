#!/usr/bin/env bash
set -euo pipefail

terraform_version="1.15.8"
archive="terraform_${terraform_version}_linux_amd64.zip"
base_url="https://releases.hashicorp.com/terraform/${terraform_version}"
work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT

curl --fail --silent --show-error --location "${base_url}/${archive}" --output "${work_dir}/${archive}"
curl --fail --silent --show-error --location "${base_url}/terraform_${terraform_version}_SHA256SUMS" --output "${work_dir}/SHA256SUMS"
(
  cd "${work_dir}"
  grep " ${archive}$" SHA256SUMS | sha256sum --check --status
)
unzip -q "${work_dir}/${archive}" -d "${work_dir}"
install -m 0755 "${work_dir}/terraform" /usr/local/bin/terraform
terraform version
