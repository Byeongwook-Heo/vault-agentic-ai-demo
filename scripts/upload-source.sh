#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 3 ]]; then
  echo "usage: $0 <bucket> <key> <archive>" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "${script_dir}/.." && pwd)"

source "${script_dir}/aws-credentials.sh"
load_demo_aws_credentials

bucket="$1"
key="$2"
archive="$3"
archive_dir="$(dirname "${archive}")"
mkdir -p "${archive_dir}"

if [[ "${ALLOW_DIRTY_SOURCE_UPLOAD:-false}" != "true" ]]; then
  git -C "${project_dir}" diff --quiet
  git -C "${project_dir}" diff --cached --quiet
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

# Only committed source is packaged. Private inputs are stored separately.
git -C "${project_dir}" archive --format=tar HEAD | tar -xf - -C "${tmp_dir}"

(
  cd "${tmp_dir}"
  zip -qr "${tmp_dir}/source.zip" .
)
mv "${tmp_dir}/source.zip" "${archive}"
aws s3 cp "${archive}" "s3://${bucket}/${key}" --only-show-errors
rm -f "${archive}"
echo "Source archive uploaded to the versioned artifact bucket."
