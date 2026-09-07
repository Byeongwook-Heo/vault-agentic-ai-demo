#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/agent-runtime-common.sh"
resolve_agent_runtime

case "${state}" in
  stopped)
    aws ec2 start-instances --region "${AWS_REGION}" --instance-ids "${INSTANCE_ID}" >/dev/null
    ;;
  running)
    ;;
  *)
    echo "The private planning runtime is currently ${state}; try again after the transition completes." >&2
    exit 2
    ;;
esac

aws ec2 wait instance-status-ok --region "${AWS_REGION}" --instance-ids "${INSTANCE_ID}"
echo "Private agent runtime instance is running. Check the chatbot planning status for model readiness."
