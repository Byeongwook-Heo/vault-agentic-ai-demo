#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/aws-credentials.sh"
load_demo_aws_credentials

project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
source_cidrs="${BOB_SOURCE_CIDRS:-}"
if [[ -z "${source_cidrs}" ]]; then
  public_ip="$(curl --fail --silent --show-error https://checkip.amazonaws.com | tr -d '[:space:]')"
  source_cidrs="${public_ip}/32"
fi

IFS=',' read -r -a cidrs <<<"${source_cidrs}"
for cidr in "${cidrs[@]}"; do
  if [[ ! "${cidr}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$ ]]; then
    echo "Invalid IPv4 CIDR: ${cidr}" >&2
    exit 2
  fi
done

aws ssm put-parameter \
  --name "/${project_name}/allowed-source-cidrs" \
  --description "Public source CIDRs allowed to reach the demo ALB" \
  --type StringList \
  --overwrite \
  --value "${source_cidrs}" >/dev/null

echo "ALB source restriction stored without opening the endpoint globally."
