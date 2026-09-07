# IBM Verify 로그인 · OBO 설정

[전체 설치 가이드](SETUP.ko.md) · [English setup](SETUP.en.md)

## 사용자용 OIDC 앱

Authorization Code + PKCE S256을 사용합니다. Redirect URI는 실제 챗봇의 `/auth/callback`, Access Token 형식은 JWT, scope는 `openid profile vault.db.read`입니다. 앱에 로그인할 수 있는 사용자 entitlement와 데이터 권한은 별도로 설정합니다.

## Agent STS client

- Grant: `urn:ietf:params:oauth:grant-type:token-exchange`
- Subject / requested type: `urn:ietf:params:oauth:token-type:access_token`
- Client 인증: `private_key_jwt`
- JWKS URI: 실제 챗봇의 `/.well-known/jwks.json`
- Output: JWT, RS256, scope `vault.db.read`
- OBO에는 사용자 `sub`, Agent `client_id`, 승인된 `access_tier`를 보존합니다.

OBO audience는 실제 STS 발급 토큰과 일치해야 합니다. 사용자 앱 audience, STS client ID, 사람이 붙인 대상 별칭을 임의로 서로 바꾸지 마세요. Verify, Agent, MCP, Vault role의 issuer/audience/actor 설정을 일치시킵니다.

## AWS에 전달할 공개 메타데이터

```bash
export VERIFY_USER_AUTHORIZATION_URL='https://<tenant>/v1.0/endpoint/default/authorize'
export VERIFY_USER_TOKEN_URL='https://<tenant>/v1.0/endpoint/default/token'
export VERIFY_USER_JWKS_URL='https://<tenant>/v1.0/endpoint/default/jwks'
export VERIFY_USER_ISSUER='<actual-user-token-issuer>'
export VERIFY_USER_CLIENT_ID='<user-oidc-client-id>'
export VERIFY_USER_AUDIENCE='<actual-user-token-audience>'
export VERIFY_USER_SCOPES='openid profile vault.db.read'
export VERIFY_OBO_TOKEN_URL='https://<tenant>/oauth2/token'
export VERIFY_OBO_JWKS_URL='https://<tenant>/oauth2/jwks'
export VERIFY_OBO_ISSUER='<actual-obo-issuer>'
export VERIFY_OBO_CLIENT_ID='<agent-sts-client-id>'
export VERIFY_OBO_AUDIENCE='<actual-obo-audience>'
export VERIFY_OBO_SCOPE='vault.db.read'
export VERIFY_OBO_ACTOR_CLAIM='client_id'
export VERIFY_OBO_ACTOR_VALUE="${VERIFY_OBO_CLIENT_ID}"

make configure-chatbot-verify
make bootstrap-chat-session-secret
make bootstrap-contextforge-secret
```

URL은 형식 예시입니다. 실제 테넌트 메타데이터를 확인하세요. 토큰·client secret·private key를 명령 출력이나 GitHub에 포함하지 마세요.

## 권한 매핑

[권한 설정](ACCESS_TIER_SETUP.md)에 따라 사용자 JWT와 OBO JWT 양쪽에 서명된 tier를 넣습니다. claim이 없거나 잘못되면 `enforce` 모드에서 보호 데이터 접근을 거부합니다. 그룹 이름만 만들거나 로그인 앱 entitlement만 추가해도 JWT에 자동 반영된다고 가정하지 않습니다.

이후 `make vault-bootstrap`, `make deploy-chatbot`을 실행하여 Vault role과 앱 설정을 적용합니다. 실제 두 계정으로 최종 테스트해야 합니다.

## 확인 위치

관리 UI 보고서는 사용자/토큰 이벤트 확인용이며 OBO 원문을 항상 보여주는 화면이 아닙니다. 챗봇 단계 팝업은 정제된 수행 설명·예시 코드입니다. 실토큰이 필요 없는 로그와 claim 검증 결과를 우선 사용하세요.

공식 참고: [Verify Token Exchange](https://docs.verify.ibm.com/verify/docs/oauth-20-token-exchange), [PKCE 예제](https://docs.verify.ibm.com/verify/docs/developer-portal-authorization-code-with-pkce-example).
