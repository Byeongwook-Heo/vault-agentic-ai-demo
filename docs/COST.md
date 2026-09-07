# 비용과 종료 점검

가격표가 아니라 Terraform 기본 구성의 비용 항목 목록입니다. 실제 요금은 region, 가동 시간, 트래픽, 할인에 따라 AWS에서 확인하세요.

- Vault EC2 `t3.medium` 및 EBS
- private 추론 EC2 `c7i.2xlarge` 및 모델 저장용 EBS (CPU 구성, GPU 아님)
- bastion EC2 및 public IPv4/EIP
- RDS PostgreSQL `db.t4g.micro`, DB 저장소·백업
- ALB와 ECS Fargate task (챗봇 모드 기본 1 vCPU / 2 GiB)
- 기존 VPC의 NAT/API endpoint, 데이터 처리·송신
- CodeBuild, ECR 이미지, S3 소스/state·버전, CloudWatch 로그
- KMS, Secrets Manager, Route 53

`make agent-runtime-stop`은 추론 EC2만 중지합니다. EBS와 다른 리소스 비용은 남을 수 있습니다.

Terraform destroy와 별도로 CloudFormation bootstrap stack이 있고, ECR/S3 등에 Retain 정책이 있습니다. RDS 백업/스냅샷, S3 이전 버전, 로그, EIP 등도 확인하세요. KMS·Secret·라이선스를 재사용하려면 삭제 전에 복구 절차와 보존 대상을 정해야 합니다.

비용 최적화는 데이터 보존과 충돌할 수 있으므로, 승인 없이 destroy나 저장 데이터 삭제를 실행하지 않습니다.
