# 설치 가이드 (한국어)

[English](SETUP.en.md) · [README](../README.md)

격리된 AWS 실습 환경에 배포하세요. 단위 테스트 통과와 실제 배포 성공은 별개의 확인 항목입니다. 배포 후 해당 환경에서 접속·인증·권한 검증을 수행해야 합니다.

## 1. 사전 준비

- AWS CLI v2, Bash, jq, Git, zip, curl, AWS Session Manager plugin
- 유효한 AWS SSO/profile 또는 환경 자격증명
- 기존 VPC: 인터넷 연결 ALB용 public subnet 2개, NAT/필요 API 연결이 되는 private app subnet 2개, private DB subnet 2개
- VPC DNS resolution/hostnames, Route 53 public zone, 버전 관리·암호화된 Terraform state S3 bucket
- 승인된 Ubuntu 22.04 x86_64 AMI와 소유 계정. 기본 AMI 이름 필터는 `hc-base-*` / `hc-security-base-*`이므로 다른 AMI는 [data.tf](../infra/terraform/data.tf)의 필터와 bootstrap 호환성을 검토해야 합니다.
- Vault Enterprise 라이선스, IBM Verify 관리자 권한과 테스트 사용자 2명
- 모델 사용 조건을 확인한 private inference runtime. 기본 예제는 CPU 인스턴스를 생성합니다.
- 설치 담당자의 CloudFormation/IAM/CodeBuild/EC2/ECS/RDS/KMS/SSM/DNS 권한. 설치용 role은 광범위하므로 격리된 lab 계정에서 검토하여 사용합니다.

앱 기본 식별자는 `bob-vault-nhi-demo`입니다. **Git 저장소 이름과 별개**이며, 기존 이름과 충돌하지 않는 계정/VPC에서 시작하세요. region 기본값은 `ap-northeast-2`입니다. region을 변경하면 AMI, DB 엔진 가용 버전, UI 콘솔 링크도 확인합니다.

## 2. 비공개 입력값

```bash
git clone https://github.com/Byeongwook-Heo/vault-agentic-ai-demo.git
cd vault-agentic-ai-demo

export AWS_PROFILE='demo-operator'
export AWS_REGION='ap-northeast-2'
aws sso login --profile "$AWS_PROFILE"  # SSO profile을 사용할 때만
aws sts get-caller-identity

export AWS_ACCOUNT_ID='<대상 AWS 계정 ID>'
export VPC_ID='<VPC ID>'
export APP_SUBNET_IDS='<private app subnet A>,<private app subnet B>'
export TF_STATE_BUCKET='<기존 state bucket>'
export VAULT_LICENSE_FILE='<라이선스 파일 위치>'
export BOB_SOURCE_CIDRS='<데모 접속 공인 IPv4>/32'

cp infra/terraform/deployment.tfvars.json.example deployment.tfvars.json
export DEPLOYMENT_VARS_FILE='deployment.tfvars.json'
```

`deployment.tfvars.json`의 모든 예제 값을 편집합니다. 위 환경변수와 subnet/VPC 값을 일치시키세요. event operator의 IAM role과 미래의 UTC 종료 시각 3개는 같은 만료 시점으로 설정합니다. SSH를 사용하지 않으면 `event_ssh_users={}`를 유지합니다. Verify JWKS 허용 IP는 **본인 Verify 리전의 공식 egress 주소**를 확인하여 /32로 넣습니다.

입력 파일은 Git에서 제외되며 프로젝트별 SSM SecureString으로 전달됩니다. 개인 파일 경로나 비밀값을 README, tracked 설정, shell history에 직접 넣지 마세요.

## 3. AWS 빌드 기반 / 기본 리소스

아래부터 실제 비용과 리소스 변경이 발생합니다.

```bash
make aws-preflight
make bootstrap-aws
make configure-deployment
make upload-source
make ci
make tf-plan
# plan 검토 후
make tf-apply-base
make vault-init
make db-bootstrap
make build-image
make deploy-mcp-bootstrap
```

`make upload-source`는 **HEAD에 커밋된 소스만** 업로드합니다. 변경 사항은 먼저 검토·커밋하세요. 비공개 tfvars는 소스 ZIP에 포함하지 않으며 CodeBuild가 SSM에서 읽습니다. 초기 Vault 설치는 공식 릴리스 또는 직접 승인한 artifact cache를 사용합니다. 바이너리는 Git에 넣지 않습니다.

## 4. Verify / 권한 설정

[Verify 설정 가이드](CHATBOT_VERIFY_SETUP.md)를 따라 두 개의 등록을 준비합니다.

1. 사용자용 OIDC 앱: Authorization Code + PKCE S256, JWT Access Token, 실제 `/auth/callback`.
2. Agent용 STS client: Token Exchange, `private_key_jwt`, 실제 `/.well-known/jwks.json`.
3. 두 테스트 사용자의 JWT에 `access_tier=orders-full` 또는 `orders-limited`를 넣고 OBO에도 보존합니다.
4. 실제 발급 토큰의 issuer/audience/actor와 환경 입력을 일치시킵니다. 사용자 앱 client ID와 OBO audience가 항상 같다고 가정하지 마세요. OBO audience도 임의의 별칭으로 정하지 않습니다.
5. 공개 메타데이터 환경변수를 설정한 뒤 아래 명령을 실행합니다.

```bash
make configure-chatbot-verify
make bootstrap-chat-session-secret
make bootstrap-contextforge-secret
make bootstrap-agent-runtime-secret
make vault-bootstrap
make chatbot-plan
# plan 검토 후
make deploy-chatbot
```

UI의 Verify 관리 링크는 샘플 테넌트 주소입니다. 운영자 링크를 사용하려면 [app.js](../apps/mcp-server/public/app.js)의 `stageDestinations`에서 배포 환경에 맞추세요. 해당 파일에 실제 테넌트 주소를 넣은 사본은 공개 저장소에 push하지 마세요. Vault UI 링크는 HTTPS localhost이며 SSM 터널을 먼저 시작해야 합니다.

## 5. 검증 / 행사 종료

```bash
export DEMO_URL='https://<내 챗봇 주소>'
make smoke
make access-tier-smoke
make demo-access-report
make demo-status
```

권한 리포트는 DB 역할 검증입니다. 실제 전체/제한 사용자의 Verify 로그인과 주문 요청, 로그아웃 후 계정 전환은 각각 수동 확인하세요. 일반 대화, 제한 주문, 잘못된 세션, 새로고침도 함께 점검합니다.

행사 후 `make agent-runtime-stop`은 추론 EC2만 중지합니다. RDS/ECS/ALB/NAT/스토리지/로그 등 비용은 계속 발생할 수 있습니다. `make destroy`는 명시적 확인값을 요구하며 데이터 삭제 위험이 있습니다. 백업과 별도 bootstrap 리소스·보존 정책을 확인한 뒤 실행하세요. “인스턴스 중지=비용 0”은 아닙니다.
