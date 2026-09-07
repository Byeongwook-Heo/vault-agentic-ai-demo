# 운영 · 검증 · 접속

## 상태 확인

AWS profile/SSO 세션을 준비하고 `DEMO_URL`을 본인 환경의 HTTPS 주소로 설정합니다.

```bash
make smoke
make demo-status
make access-path-audit
make access-tier-smoke
make demo-access-report
```

`demo-access-report`는 CodeBuild 시작 대기 시간이 있습니다. `scripts/bob-rds-report.sh --profile demo-operator`도 기존 bootstrap CodeBuild를 사용하며 `AWS_ACCOUNT_ID`를 명시해야 합니다. 이는 root 권한이나 익명 DB 조회를 제공하는 스크립트가 아닙니다.

## Vault UI와 터미널

DB와 Vault는 private network에 있습니다. AWS 권한을 가진 운영자가 Session Manager를 사용합니다.

```bash
export PROJECT_NAME='bob-vault-nhi-demo'
VAULT_INSTANCE_ID="$(aws ec2 describe-instances --filters "Name=tag:Name,Values=${PROJECT_NAME}-vault" "Name=instance-state-name,Values=running" --query 'Reservations[0].Instances[0].InstanceId' --output text)"
export VAULT_INSTANCE_ID
aws ssm start-session --target "$VAULT_INSTANCE_ID"
```

UI용 별도 터널:

```bash
aws ssm start-session --target "$VAULT_INSTANCE_ID" \
  --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["8200"],"localPortNumber":["8200"]}'
```

터널을 유지한 상태에서 `https://127.0.0.1:8200/ui/`를 엽니다. Vault 인증서의 CA 신뢰 및 hostname/SAN 설정을 올바르게 구성하세요. 인증서 검증을 끄는 방법을 기본으로 사용하지 않습니다. UI 로그인에는 적절한 Vault 토큰 또는 구성된 JWT role에 맞는 유효한 JWT가 별도로 필요합니다. Verify 로그인만으로 운영자 root 권한이 생기지 않습니다.

운영자 SSM role, 접속 만료 시간, IAM 정책과 인스턴스 SSM 상태를 함께 확인하세요. SSH는 선택 사항이며 키 파일/소스 IP를 저장소에 올리지 않습니다.

## 권한 비교

전체 역할: ORD-1001 ~ ORD-1004. 제한 역할: ORD-1001, ORD-1004. 최근 주문·통계도 제한 view를 사용합니다. 보고서 통과는 실제 Verify 로그인 통과와 다르므로 최종 사용자 시나리오를 별도 확인합니다.

## 종료와 비용

추론 런타임 중지는 `make agent-runtime-stop`입니다. 비용 0을 의미하지 않습니다. [비용 문서](COST.md)를 참고하고 RDS/ECS/ALB/EIP/스토리지/CloudWatch/CodeBuild/Secrets Manager/KMS와 외부 NAT 등을 확인하세요. 파괴 작업 전 백업과 사용자 승인이 필요합니다.
