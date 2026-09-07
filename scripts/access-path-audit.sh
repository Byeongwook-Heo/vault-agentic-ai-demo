#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/aws-credentials.sh"
load_demo_aws_credentials

project_name="${PROJECT_NAME:-bob-vault-nhi-demo}"
codebuild_project="${project_name}-bootstrap"
vault_record_fqdn="vault.${project_name}.internal"
region="${AWS_REGION:-ap-northeast-2}"
vault_zone="${vault_record_fqdn#vault.}"

status=0
failures=()
incomplete=false

log_pass() {
  printf '[PASS] %s\n' "$1"
}
log_fail() {
  printf '[FAIL] %s\n' "$1" >&2
  failures+=("$1")
  status=1
}
log_incomplete() {
  printf '[INCOMPLETE] %s\n' "$1" >&2
  incomplete=true
}

require_cmd() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    log_pass "${name} command exists"
  else
    log_fail "${name} command missing"
  fi
}

security_group_allows_ingress_sg() {
  local source_group="$1"
  local target_group="$2"
  local protocol="$3"
  local port="$4"
  aws ec2 describe-security-groups --group-ids "${target_group}" --output json \
    | jq -e --arg sg "$source_group" --arg p "$protocol" --argjson port "$port" '
      .SecurityGroups[]
      | .IpPermissions[]
      | select(.IpProtocol == $p and .FromPort <= $port and .ToPort >= $port)
      | .UserIdGroupPairs[]
      | select(.GroupId == $sg)
    ' >/dev/null
}

security_group_allows_egress_port() {
  local sg="$1"
  local protocol="$2"
  local port="$3"
  aws ec2 describe-security-groups --group-ids "${sg}" --output json \
    | jq -e --argjson port "$port" --arg p "$protocol" '
      .SecurityGroups[]
      | .IpPermissionsEgress[]
      | select(.IpProtocol == $p and .FromPort <= $port and .ToPort >= $port and
          ((.IpRanges // []) | length > 0))
    ' >/dev/null
}

security_group_allows_egress_cidr() {
  local sg="$1"
  local protocol="$2"
  local port="$3"
  local cidr="$4"
  aws ec2 describe-security-groups --group-ids "${sg}" --output json \
    | jq -e --argjson port "$port" --arg p "$protocol" --arg cidr "$cidr" '
      .SecurityGroups[]
      | .IpPermissionsEgress[]
      | select(.IpProtocol == $p and .FromPort <= $port and .ToPort >= $port
               and ((.IpRanges // []) | any(.CidrIp == $cidr)))
    ' >/dev/null
}

printf 'Access-Path Audit for project: %s\n' "$project_name"
printf 'AWS region          : %s\n' "$region"

require_cmd aws
require_cmd jq
(( status == 0 )) || exit 1

if ! vault_address="$(aws ssm get-parameter --region "${region}" --name "/${project_name}/vault/address" --query 'Parameter.Value' --output text)"; then
  log_incomplete "Cannot read the Vault endpoint with current AWS credentials"
  printf '\nResult: INCOMPLETE (Vault endpoint could not be inspected)\n'
  exit 2
fi
vault_host="$(printf '%s' "${vault_address}" | sed -E 's#^https?://##' | cut -d'/' -f1 | cut -d':' -f1)"
vault_port="$(printf '%s' "${vault_address}" | sed -E 's#^https?://##' | awk -F: '{print $2}')"
[[ -n "${vault_port}" ]] || vault_port=8200
printf 'Vault endpoint      : %s\n' "${vault_address}"

if ! build_json="$(aws codebuild batch-get-projects --region "${region}" --names "${codebuild_project}" --query 'projects[0]' --output json)"; then
  log_incomplete "Cannot inspect the CodeBuild project with current AWS credentials"
  printf '\nResult: INCOMPLETE (CodeBuild network metadata unavailable)\n'
  exit 2
fi
codebuild_vpc="$(printf '%s' "$build_json" | jq -r '.vpcConfig.vpcId // empty')"
codebuild_subnets="$(printf '%s' "$build_json" | jq -r '.vpcConfig.subnets // []')"
codebuild_sgs="$(printf '%s' "$build_json" | jq -r '.vpcConfig.securityGroupIds // []')"
codebuild_sg_id="$(printf '%s' "$codebuild_sgs" | jq -r '.[0] // empty')"

if [[ -n "${codebuild_vpc}" ]]; then
  log_pass "CodeBuild project ${codebuild_project} exists"
else
  log_fail "CodeBuild project ${codebuild_project} does not expose vpcConfig.vpcId"
  codebuild_vpc="NONE"
fi

vault_instance_id="$(aws ec2 describe-instances --region "${region}" \
  --filters "Name=tag:Name,Values=${project_name}-vault" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)"
if [[ -n "${vault_instance_id}" && "${vault_instance_id}" != "None" ]]; then
  log_pass "Vault instance is running"
else
  log_fail "Vault instance not found or not running"
  exit 1
fi

vault_private_ip="$(aws ec2 describe-instances --region "${region}" --instance-ids "${vault_instance_id}" \
  --query 'Reservations[0].Instances[0].PrivateIpAddress' --output text 2>/dev/null || true)"
vault_vpc="$(aws ec2 describe-instances --region "${region}" --instance-ids "${vault_instance_id}" \
  --query 'Reservations[0].Instances[0].VpcId' --output text 2>/dev/null || true)"
vault_sg="$(aws ec2 describe-instances --region "${region}" --instance-ids "${vault_instance_id}" \
  --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text 2>/dev/null || true)"

[[ -n "${vault_private_ip}" && "${vault_private_ip}" != "None" ]] && log_pass "Vault instance has private IP" || log_fail "Vault private IP is missing"
[[ -n "${vault_sg}" && "${vault_sg}" != "None" ]] && log_pass "Vault security group discovered" || log_fail "Vault security group is missing"

if [[ -n "${vault_vpc}" && "${vault_vpc}" != "None" && "${codebuild_vpc}" == "${vault_vpc}" ]]; then
  log_pass "CodeBuild and Vault are in the same VPC (${vault_vpc})"
else
  log_fail "VPC mismatch: CodeBuild=${codebuild_vpc}, Vault=${vault_vpc}"
fi

private_zone_id=""
zone_record_value=""
if zone_json="$(aws route53 list-hosted-zones-by-vpc --vpc-id "${codebuild_vpc}" --vpc-region "${region}" --output json)"; then
  private_zone_id="$(printf '%s' "$zone_json" | jq -r --arg zone "${vault_zone}." '[.HostedZoneSummaries[] | select(.Name == $zone) | .HostedZoneId][0] // empty')"
  if [[ -n "${private_zone_id}" ]]; then
    log_pass "Private hosted zone attached to Build VPC (${codebuild_vpc})"
  else
    log_fail "Private hosted zone ${vault_zone} is not attached to CodeBuild VPC (${codebuild_vpc})"
  fi
else
  log_incomplete "Cannot inspect private hosted zone association with current AWS credentials"
fi

if [[ -n "${private_zone_id}" ]]; then
  if record_json="$(aws route53 list-resource-record-sets --region "${region}" --hosted-zone-id "${private_zone_id}" --output json)"; then
    zone_record_value="$(printf '%s' "$record_json" | jq -r --arg host "${vault_record_fqdn}." '[.ResourceRecordSets[] | select(.Name == $host and .Type == "A") | .ResourceRecords[].Value][0] // empty')"
    if [[ -n "${zone_record_value}" ]]; then
      log_pass "Vault private DNS record exists: ${vault_record_fqdn} -> ${zone_record_value}"
      if [[ "${zone_record_value}" == "${vault_private_ip}" ]]; then
        log_pass "Vault DNS target matches running Vault private IP (${vault_private_ip})"
      else
        log_fail "Vault DNS target mismatch: DNS=${zone_record_value}, Vault Instance IP=${vault_private_ip}"
      fi
    else
      log_fail "Vault private DNS record ${vault_record_fqdn} not found in ${private_zone_id}"
    fi
  else
    log_incomplete "Cannot read Vault DNS record with current AWS credentials; remaining network checks will continue"
  fi
fi

if [[ -n "${codebuild_sg_id}" && "${codebuild_sg_id}" != "None" && -n "${vault_sg}" && "${vault_sg}" != "None" ]]; then
  if security_group_allows_ingress_sg "${codebuild_sg_id}" "${vault_sg}" tcp "${vault_port}"; then
    log_pass "Vault SG allows TCP ${vault_port} from CodeBuild SG (${codebuild_sg_id})"
  else
    log_fail "Vault SG does not allow TCP ${vault_port} from CodeBuild SG (${codebuild_sg_id})"
  fi
else
  log_fail "Cannot validate SG-to-SG flow (CodeBuild SG=${codebuild_sg_id}, Vault SG=${vault_sg})"
fi

vault_egress_ok=false
for sg in $(printf '%s' "${codebuild_sgs}" | jq -r '.[]'); do
  if security_group_allows_egress_port "${sg}" tcp "${vault_port}"; then
    if security_group_allows_egress_cidr "${sg}" tcp "${vault_port}" "10.0.0.0/8" || \
       security_group_allows_egress_cidr "${sg}" tcp "${vault_port}" "0.0.0.0/0"; then
      log_pass "CodeBuild SG (${sg}) allows egress TCP ${vault_port} (Vault path)"
      vault_egress_ok=true
      break
    fi
  fi
done
[[ "${vault_egress_ok}" == "true" ]] || log_fail "CodeBuild SG does not allow the expected Vault egress path"

dns_egress_ok=false
for sg in $(printf '%s' "${codebuild_sgs}" | jq -r '.[]'); do
  if security_group_allows_egress_port "${sg}" tcp 53 && security_group_allows_egress_port "${sg}" udp 53; then
    dns_egress_ok=true
    log_pass "CodeBuild SG (${sg}) allows DNS egress on TCP/UDP 53"
    break
  fi
done
[[ "${dns_egress_ok}" == "true" ]] || log_fail "CodeBuild SG does not expose DNS egress (TCP/UDP 53)"

if (( status != 0 )); then
  echo
  echo "Result: FAIL"
  echo '권장 조치: 위 FAIL 항목을 먼저 정리한 뒤 make demo-access-report를 다시 실행해 주세요.'
  echo
  echo "- CodeBuild project VPC/SG/route table, 그리고 Route53 private zone(vpcId=bob-vault-nhi-demo.internal) 연결을 먼저 확인"
  echo "- 필요 시 vault-bootstrap 완료 후 vault 인스턴스 상태와 DNS 레코드 갱신을 재확인"
  echo '- 마지막으로 make demo-access-report 재실행 시 VAULT_WAIT_* 변수로 대기 시간 튜닝 가능'
  exit 1
fi

if [[ "${incomplete}" == "true" ]]; then
  printf '\nResult: INCOMPLETE (some AWS metadata could not be inspected)\n'
  exit 2
fi

echo
echo "Result: PASS"
printf 'Vault URL check host : %s\n' "${vault_host}"
printf 'Vault record        : %s\n' "${zone_record_value:-<not found>}"
exit 0
