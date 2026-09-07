# 운영자 EC2 접근

기본 운영 접속은 [SSM 터미널 / 포트포워딩](OPERATIONS_RUNBOOK.md)을 사용합니다. 개인 키 파일 경로나 기존 팀원의 공개키는 저장소에 포함하지 않습니다.

SSH가 필요한 경우에만 비공개 Terraform 입력의 `event_ssh_users`에 사용자별 공개키를 지정합니다. private key를 입력하면 안 됩니다. bastion으로 허용된 source CIDR과 만료 시간을 설정하고 plan을 검토합니다. Vault 인스턴스는 private으로 유지하며 bastion security group에서만 SSH를 허용합니다.

공개키라도 개인 식별자이므로 공유 저장소에 커밋하지 않습니다. 세션 및 sudo 권한은 조직의 운영 정책과 SSM/IAM 설정에 따릅니다.
