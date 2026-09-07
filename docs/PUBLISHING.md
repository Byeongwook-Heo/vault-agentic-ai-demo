# 저장소 공유와 민감정보 제외

이 저장소는 운영 작업 폴더에서 필요한 소스만 분리한 새 이력으로 시작합니다. 예전 저장소의 커밋 이력을 복사하지 않습니다.

포함: 애플리케이션 소스, UI 자산, 테스트, Terraform·CodeBuild 템플릿, 익명화한 문서, 미승인 사용자 UI 캡처.

제외: 실제 AWS 계정/리소스 ID, 테넌트·사용자·운영 URL, 개인 절대 경로, AWS credentials 파일, JWT/비밀값, SSH key, Vault 라이선스, Terraform state/plan, 로그, 브라우저 세션, 다운로드한 Vault 바이너리.

배포 입력은 무시되는 `deployment.tfvars.json`에 작성하고 `make configure-deployment`로 프로젝트별 SSM SecureString에 저장합니다. 표준 AWS profile/SSO/IAM role을 사용하며 개인 Downloads 폴더에서 파일을 자동 탐색하지 않습니다.

```bash
npm run check:publication
git diff --cached --stat
```

검사기는 알려진 비밀 패턴과 개인 경로, 금지 파일을 차단합니다. 모든 비밀을 탐지하는 보증은 아니므로 신규 파일·스크린샷도 사람이 검토하세요. 로그/토큰을 GitHub Issue에 붙이지 마세요.

기존 저장소의 파일을 현재 버전에서 지워도 과거 커밋은 남습니다. 실제 비밀 유출이 확인되면 우선 폐기·교체하고, 이력 재작성은 별도 승인·협업 조율 후 수행해야 합니다. 새 저장소 생성만으로 기존 저장소 이력이 삭제되지는 않습니다.

브랜드 자산·폰트·모델·Vault Enterprise에는 각각의 권리/라이선스가 적용됩니다. 저장소에 일괄적인 오픈소스 라이선스를 임의로 부여하지 않았습니다. [제3자 고지](../THIRD_PARTY_NOTICES.md)
