#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "${script_dir}/.." && pwd)"
source "${script_dir}/aws-credentials.sh"
load_demo_aws_credentials

project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
account_id="${AWS_ACCOUNT_ID:?Set AWS_ACCOUNT_ID}"
region="${AWS_REGION:-ap-northeast-2}"
artifact_bucket="${ARTIFACT_BUCKET:-${project_name}-artifacts-${account_id}-${region}}"
vpc_id="${VPC_ID:?Set VPC_ID}"
app_subnet_ids="${APP_SUBNET_IDS:?Set APP_SUBNET_IDS}"
state_bucket="${TF_STATE_BUCKET:?Set TF_STATE_BUCKET}"

aws cloudformation deploy \
  --region "${region}" \
  --stack-name "${project_name}-build" \
  --template-file "${project_dir}/infra/bootstrap/cloudformation.yaml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProjectName="${project_name}" \
    ArtifactBucketName="${artifact_bucket}" \
    ExistingVpcId="${vpc_id}" \
    AppSubnetIds="${app_subnet_ids}" \
    TerraformStateBucket="${state_bucket}"

echo "AWS build plane is ready."
