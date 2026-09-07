#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/agent-runtime-common.sh"
resolve_agent_runtime

aws ec2 stop-instances --region "${AWS_REGION}" --instance-ids "${INSTANCE_ID}" >/dev/null
echo "Private agent planning runtime stop requested."
