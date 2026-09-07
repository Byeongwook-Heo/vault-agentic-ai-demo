#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 1 || "$#" -gt 2 ]]; then
  echo "usage: $0 <project> [NAME=value,NAME=value]" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/aws-credentials.sh"
load_demo_aws_credentials

project_name="$1"
overrides="${2:-}"
arguments=(--project-name "${project_name}")
if [[ -n "${overrides}" ]]; then
  environment_json="["
  delimiter=""
  IFS=',' read -r -a pairs <<<"${overrides}"
  for pair in "${pairs[@]}"; do
    name="${pair%%=*}"
    value="${pair#*=}"
    if [[ ! "${name}" =~ ^[A-Z][A-Z0-9_]*$ ]]; then
      echo "Invalid environment variable name: ${name}" >&2
      exit 2
    fi
    escaped_value="${value//\\/\\\\}"
    escaped_value="${escaped_value//\"/\\\"}"
    environment_json+="${delimiter}{\"name\":\"${name}\",\"value\":\"${escaped_value}\",\"type\":\"PLAINTEXT\"}"
    delimiter=","
  done
  environment_json+="]"
  arguments+=(--environment-variables-override "${environment_json}")
fi

build_id="$(aws codebuild start-build "${arguments[@]}" --query 'build.id' --output text)"
echo "Started CodeBuild job: ${build_id}"

print_build_logs() {
  local log_group log_stream
  log_group="$(aws codebuild batch-get-builds --ids "${build_id}" --query 'builds[0].logs.groupName' --output text)"
  log_stream="$(aws codebuild batch-get-builds --ids "${build_id}" --query 'builds[0].logs.streamName' --output text)"
  if [[ "${log_group}" != "None" && "${log_stream}" != "None" ]]; then
    aws logs get-log-events \
      --log-group-name "${log_group}" \
      --log-stream-name "${log_stream}" \
      --limit 80 \
      --query 'events[].message' \
      --output text
  fi
}

print_build_report() {
  local log_group log_stream
  log_group="$(aws codebuild batch-get-builds --ids "${build_id}" --query 'builds[0].logs.groupName' --output text)"
  log_stream="$(aws codebuild batch-get-builds --ids "${build_id}" --query 'builds[0].logs.streamName' --output text)"
  if [[ "${log_group}" != "None" && "${log_stream}" != "None" ]]; then
    aws logs get-log-events \
      --log-group-name "${log_group}" \
      --log-stream-name "${log_stream}" \
      --limit 500 \
      --query 'events[].message' \
      --output json \
      | jq -r '.[] | gsub("\\r"; "") | rtrimstr("\\n")' \
      | awk '
          /DEMO_ACCESS_REPORT_BEGIN/ {
            printing = 1
            next
          }
          /DEMO_ACCESS_REPORT_END/ { printing = 0; next }
          printing && $0 !~ /^[[:space:]]*$/ { print }
        '
  fi
}

while true; do
  status="$(aws codebuild batch-get-builds --ids "${build_id}" --query 'builds[0].buildStatus' --output text)"
  case "${status}" in
    SUCCEEDED)
      echo "CodeBuild succeeded."
      if [[ "${PRINT_BUILD_REPORT:-0}" == "1" ]]; then
        print_build_report || echo "Warning: CodeBuild report could not be retrieved." >&2
      elif [[ "${PRINT_BUILD_LOGS:-0}" == "1" ]]; then
        print_build_logs || echo "Warning: CodeBuild logs could not be retrieved." >&2
      fi
      exit 0
      ;;
    FAILED|FAULT|STOPPED|TIMED_OUT)
      echo "CodeBuild ended with ${status}." >&2
      print_build_logs >&2 || true
      exit 1
      ;;
    *)
      echo "CodeBuild status: ${status}"
      sleep 10
      ;;
  esac
done
