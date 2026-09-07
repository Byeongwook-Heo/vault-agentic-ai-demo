# 권한 부여와 차단 위치

## 1. IBM Verify에서 부여

관리자가 사용자 그룹/속성/entitlement를 구성하고, 사용자 Access JWT와 교환된 OBO JWT에 `access_tier`를 서명해 넣습니다.

- 전체 승인: `orders-full`
- 제한 승인: `orders-limited`
- 미승인: claim 없음 또는 지원하지 않는 값

앱 로그인 entitlement와 데이터 tier는 별개입니다. 로그인만 허용했다고 DB 조회까지 승인되는 것은 아닙니다. 실제 사용자 ID나 메일 주소를 코드에 추가하지 않습니다.

## 2. Agent와 MCP에서 확인

Agent는 데이터 요청에 앞서 사용자 세션과 tier를 확인합니다. OBO 교환 후에도 JWT를 검증합니다. MCP는 전달된 JWT의 서명, issuer, audience, Agent claim, tier를 다시 확인하고 고정된 도구/인자만 허용합니다.

`ACCESS_TIER_ENFORCEMENT=enforce`가 기본입니다. `off`와 `audit`는 과거 호환 모드로, 승인 정보가 없어도 전체 조회를 유지할 수 있으므로 이 데모의 권한 비교에는 사용하지 마세요.

## 3. Vault에서 묶기

| Claim          | JWT role           | 허용 credential 경로              |
| -------------- | ------------------ | --------------------------------- |
| orders-full    | bob-orders-full    | database/creds/bob-orders-full    |
| orders-limited | bob-orders-limited | database/creds/bob-orders-limited |

각 role의 bound claims와 별도 Vault policy로 다른 tier의 DB 자격증명 발급을 막습니다. Gateway 자체 인증은 이 권한을 대신하지 않습니다.

## 4. PostgreSQL에서 최종 제한

| DB group role             | SELECT view                | 주문 범위           |
| ------------------------- | -------------------------- | ------------------- |
| bob_orders_full_reader    | v_bob_order_status_full    | ORD-1001 ~ ORD-1004 |
| bob_orders_limited_reader | v_bob_order_status_limited | ORD-1001, ORD-1004  |

제한 view는 합성 고객 `CUS-1001` 범위입니다. 주문 상태뿐 아니라 최근 주문·실패 결제 요약·통계도 동일한 tier view를 사용합니다. 제한 사용자의 ORD-1002 요청은 존재 여부를 노출하지 않도록 “조회 권한이 없거나 주문을 찾을 수 없음”으로 처리합니다.

## 5. 검증

```bash
make access-tier-smoke
make demo-access-report
make smoke
make demo-status
```

앞의 두 명령은 CodeBuild를 실행하므로 시작 대기 시간이 있습니다. 이는 Vault/DB 역할 검증이며 실제 두 사용자의 Verify 로그인을 대체하지 않습니다. 각각 로그인하여 ORD-1001, ORD-1002, 최근 주문, 실패 결제 통계를 확인하세요.
