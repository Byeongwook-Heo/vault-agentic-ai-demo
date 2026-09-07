# Bob / MCP 연결

주요 사용 경로는 [챗봇](../README.md)의 Verify 로그인 → Agent → ContextForge → MCP 흐름입니다.

별도 MCP client 연결 예시는 [bob/mcp.json.example](../bob/mcp.json.example)에 있습니다. 실제 endpoint와 토큰은 클라이언트의 비공개 설정에 저장합니다. 기본 챗봇의 OBO 보호 경로에 임의의 static bearer token을 넣어도 사용자 권한을 대신할 수 없습니다.

클라이언트가 배포된 인증 모드 및 헤더 전달을 지원하는지 먼저 확인하세요. public 공유 설정에는 실제 주소나 토큰을 포함하지 않습니다.
