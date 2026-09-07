# IBM Verify 설정 안내

현재 챗봇 경로는 사용자 OIDC 앱과 Agent STS client를 사용하는 **OBO Token Exchange**입니다.

- [사용자 로그인·OBO 설정](CHATBOT_VERIFY_SETUP.md)
- [권한 tier 설정](ACCESS_TIER_SETUP.md)
- [전체 설치](SETUP.ko.md)

코드에는 이전 client_credentials 기반 경로와 관리용 helper가 호환 목적으로 남아 있습니다. 현재 챗봇 설치와 혼합해서 사용하지 마세요. 특히 관리 client 변경 스크립트는 별도 관리자 승인·확인값이 필요하며 일반 데모 실행 단계가 아닙니다.
