#!/usr/bin/env bash
set -euo pipefail

# Portable RDS access report for authorized demo operators.
#
# This script has no dependency on the repository or the caller's current
# directory. It starts the existing private CodeBuild report job, which obtains
# short-lived PostgreSQL credentials from Vault, queries the approved read-only
# full-order view, revokes the lease, and prints only the sanitized data report.

project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
aws_region="${AWS_REGION:-ap-northeast-2}"
aws_profile="${AWS_PROFILE:-}"
expected_account_id="${AWS_ACCOUNT_ID:-}"
poll_seconds="${POLL_SECONDS:-5}"
timeout_seconds="${TIMEOUT_SECONDS:-600}"

usage() {
  cat <<'EOF'
Usage: bob-rds-report.sh [options]

Query the private demo RDS through the approved CodeBuild/Vault path and print
all synthetic order-status rows from the approved read-only view.

Options:
  --profile NAME       AWS CLI profile to use
  --region REGION      AWS region (default: ap-northeast-2)
  --project NAME       Demo project name (default: bob-vault-nhi-demo)
  --timeout SECONDS    Maximum wait time (default: 600)
  --help               Show this help

Requirements:
  - aws CLI and jq
  - Valid AWS profile/SSO or environment credentials; set AWS_ACCOUNT_ID
  - Permission to start/read the bob-vault-nhi-demo-bootstrap CodeBuild job
    and read its CloudWatch log stream

Examples:
  ./bob-rds-report.sh
  ./bob-rds-report.sh --profile demo-operator
  AWS_PROFILE=demo-operator ./bob-rds-report.sh
EOF
}

require_value() {
  local option="$1"
  local value="${2:-}"
  if [[ -z "${value}" || "${value}" == --* ]]; then
    echo "Missing value for ${option}" >&2
    usage >&2
    exit 2
  fi
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --profile)
      require_value "$1" "${2:-}"
      aws_profile="$2"
      shift 2
      ;;
    --region)
      require_value "$1" "${2:-}"
      aws_region="$2"
      shift 2
      ;;
    --project)
      require_value "$1" "${2:-}"
      project_name="$2"
      shift 2
      ;;
    --timeout)
      require_value "$1" "${2:-}"
      timeout_seconds="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for command_name in aws jq awk; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is not installed: ${command_name}" >&2
    exit 1
  fi
done

if [[ ! "${project_name}" =~ ^[A-Za-z0-9][A-Za-z0-9_-]*$ ]]; then
  echo "Invalid project name: ${project_name}" >&2
  exit 2
fi
if [[ ! "${timeout_seconds}" =~ ^[1-9][0-9]*$ ]]; then
  echo "Timeout must be a positive integer: ${timeout_seconds}" >&2
  exit 2
fi
if [[ ! "${poll_seconds}" =~ ^[1-9][0-9]*$ ]]; then
  echo "POLL_SECONDS must be a positive integer: ${poll_seconds}" >&2
  exit 2
fi

aws_options=(--region "${aws_region}")
if [[ -n "${aws_profile}" ]]; then
  aws_options+=(--profile "${aws_profile}")
fi

aws_cli() {
  aws "${aws_options[@]}" "$@"
}

: "${expected_account_id:?Set AWS_ACCOUNT_ID to the intended account ID}"
if ! account_id="$(aws_cli sts get-caller-identity --query Account --output text)"; then
  echo "AWS authentication failed. Refresh your SSO/profile or environment credentials." >&2
  exit 1
fi

if [[ "${account_id}" != "${expected_account_id}" ]]; then
  echo "Refusing to run in AWS account ${account_id}; expected ${expected_account_id}." >&2
  exit 1
fi

codebuild_project="${project_name}-bootstrap"
build_id="$(
  aws_cli codebuild start-build \
    --project-name "${codebuild_project}" \
    --environment-variables-override \
      name=BOOTSTRAP_ACTION,value=rds-data-report,type=PLAINTEXT \
    --query 'build.id' \
    --output text
)"

echo "RDS access report started: ${build_id}"
deadline=$((SECONDS + timeout_seconds))

while true; do
  build_status="$(
    aws_cli codebuild batch-get-builds \
      --ids "${build_id}" \
      --query 'builds[0].buildStatus' \
      --output text
  )"

  case "${build_status}" in
    SUCCEEDED)
      break
      ;;
    FAILED|FAULT|STOPPED|TIMED_OUT)
      echo "RDS access report failed: ${build_status}" >&2
      exit 1
      ;;
    IN_PROGRESS)
      echo "RDS access report: ${build_status}"
      ;;
    *)
      echo "Unexpected CodeBuild status: ${build_status}" >&2
      exit 1
      ;;
  esac

  if (( SECONDS >= deadline )); then
    echo "Timed out waiting for ${build_id}; the remote build was not stopped." >&2
    exit 1
  fi
  sleep "${poll_seconds}"
done

log_group="$(
  aws_cli codebuild batch-get-builds \
    --ids "${build_id}" \
    --query 'builds[0].logs.groupName' \
    --output text
)"
log_stream="$(
  aws_cli codebuild batch-get-builds \
    --ids "${build_id}" \
    --query 'builds[0].logs.streamName' \
    --output text
)"

if [[ -z "${log_group}" || -z "${log_stream}" || "${log_group}" == "None" || "${log_stream}" == "None" ]]; then
  echo "The build succeeded, but its CloudWatch log location was unavailable." >&2
  exit 1
fi

report="$(
  aws_cli logs get-log-events \
    --log-group-name "${log_group}" \
    --log-stream-name "${log_stream}" \
    --start-from-head \
    --limit 1000 \
    --output json \
    | jq -r '.events[].message' \
    | awk '
        /RDS_DATA_REPORT_BEGIN/ { printing = 1; next }
        /RDS_DATA_REPORT_END/   { printing = 0; next }
        printing && $0 !~ /^[[:space:]]*$/ {
          gsub(/\r$/, "")
          print
        }
      '
)"

if [[ -z "${report//[[:space:]]/}" ]]; then
  echo "The build succeeded, but no sanitized report section was found." >&2
  exit 1
fi

printf '\n%s\n' "${report}"
