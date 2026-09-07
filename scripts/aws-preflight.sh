#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/aws-credentials.sh"
load_demo_aws_credentials
: "${AWS_ACCOUNT_ID:?Set the intended AWS account ID}"
: "${VPC_ID:?Set VPC_ID}"
: "${APP_SUBNET_IDS:?Set comma-separated private application subnets}"
: "${TF_STATE_BUCKET:?Set an existing encrypted, versioned state bucket}"
: "${VAULT_LICENSE_FILE:?Set your Vault Enterprise license file}"
actual_account="$(aws sts get-caller-identity --query Account --output text)"
[[ "${actual_account}" == "${AWS_ACCOUNT_ID}" ]] || { echo "AWS account mismatch." >&2; exit 1; }
aws ec2 describe-vpcs --vpc-ids "${VPC_ID}" >/dev/null
IFS=',' read -r -a subnets <<<"${APP_SUBNET_IDS}"
aws ec2 describe-subnets --subnet-ids "${subnets[@]}" --output json |
  jq -e --arg vpc "${VPC_ID}" 'all(.Subnets[]; .VpcId == $vpc)' >/dev/null
aws s3api head-bucket --bucket "${TF_STATE_BUCKET}" >/dev/null
test -s "${VAULT_LICENSE_FILE}"
echo "AWS identity, application subnets, state bucket and license file are available."
