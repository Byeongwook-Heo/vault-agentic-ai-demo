# 소스와 문서 공유 지침

애플리케이션, 테스트, 인프라 템플릿과 UI 자료를 공유할 때 다음 항목을 확인합니다.

## 환경 설정과 비밀값

실제 계정·테넌트·접속 주소·개인 경로와 자격증명을 문서에 기록하지 마세요. AWS 키, JWT, SSH 개인키, Vault 라이선스, Terraform state/plan, 로그와 브라우저 세션은 Git에 저장하지 않습니다.

배포 입력은 Git에서 제외되는 `deployment.tfvars.json`에 작성하고 `make configure-deployment`로 프로젝트별 SSM SecureString에 저장합니다. AWS 인증은 표준 profile/SSO/IAM role을 사용합니다.

## 게시 전 검사

```bash
npm run check:publication
git diff --cached --stat
```

검사기는 알려진 비밀 패턴과 개인 경로, 금지 파일을 검사합니다. 모든 비밀을 탐지하는 것은 아니므로 신규 파일과 스크린샷도 직접 검토하세요. 토큰이나 비밀값이 포함된 로그를 Issue에 붙이지 마세요. 실제 노출이 확인되면 해당 자격증명을 폐기·교체하고 조직의 사고 대응 절차를 따릅니다.

## 제3자 자산

브랜드 자산·폰트·모델·Vault Enterprise에는 각각의 권리와 라이선스가 적용됩니다. 재배포 조건을 확인하세요. [제3자 고지](../THIRD_PARTY_NOTICES.md)
