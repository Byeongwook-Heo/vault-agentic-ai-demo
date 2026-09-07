const root = document.documentElement;
const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
const themeToggle = document.querySelector("#theme-toggle");
const themeToggleLabel = document.querySelector("#theme-toggle-label");
const themeSymbol = document.querySelector(".theme-symbol");
const topnav = document.querySelector("#topnav");
const loginPanel = document.querySelector("#login-panel");
const workspace = document.querySelector("#workspace");
const headerLogin = document.querySelector("#header-login");
const identity = document.querySelector("#identity");
const identityState = document.querySelector("#identity-state");
const userName = document.querySelector("#user-name");
const userInitial = document.querySelector("#user-initial");
const agentGreeting = document.querySelector("#agent-greeting");
const accessContext = document.querySelector("#access-context");
const accessModeBanner = document.querySelector("#access-mode-banner");
const accessModeIcon = accessModeBanner.querySelector(".carbon-icon");
const accessModeTitle = document.querySelector("#access-mode-title");
const accessModeDescription = document.querySelector(
  "#access-mode-description",
);
const accessModeLogin = document.querySelector("#access-mode-login");
const loginError = document.querySelector("#login-error");
const previewStatus = document.querySelector("#preview-status");
const unauthTest = document.querySelector("#unauth-test");
const unauthResult = document.querySelector("#unauth-result");
const unauthOutcome = document.querySelector("#unauth-outcome");
const verifyDemoDialog = document.querySelector("#verify-demo-dialog");
const verifyDemoClose = document.querySelector("#verify-demo-close");
const verifyDemoForm = document.querySelector("#verify-demo-form");
const verifyDemoUsername = document.querySelector("#verify-demo-username");
const verifyDemoPassword = document.querySelector("#verify-demo-password");
const verifyDemoPasswordToggle = document.querySelector(
  "#verify-demo-password-toggle",
);
const verifyDemoFill = document.querySelector("#verify-demo-fill");
const verifyDemoSubmit = document.querySelector("#verify-demo-submit");
const verifyDemoError = document.querySelector("#verify-demo-error");
const verifyDemoResultPanel = document.querySelector(
  "#verify-demo-result-panel",
);
const verifyDemoFinish = document.querySelector("#verify-demo-finish");
const serviceVersion = document.querySelector("#service-version");
const conversation = document.querySelector("#conversation");
const chatScroll = document.querySelector(".chat-scroll");
const suggestions = document.querySelector("#suggestions");
const shuffleSuggestionsButton = document.querySelector("#shuffle-suggestions");
const trace = document.querySelector("#trace");
const traceLiveState = document.querySelector("#trace-live-state");
const traceStageCount = document.querySelector("#trace-stage-count");
const traceStageDetail = document.querySelector("#trace-stage-detail");
const pathProgress = document.querySelector("#path-progress");
const traceProgressFill = document.querySelector("#trace-progress-fill");
const form = document.querySelector("#chat-form");
const input = document.querySelector("#chat-input");
const send = document.querySelector("#send");
const logout = document.querySelector("#logout");
const readiness = document.querySelector("#readiness");
const planningReadiness = document.querySelector("#planning-readiness");
const mode = document.querySelector("#mode");
const eventList = document.querySelector("#events");
const refresh = document.querySelector("#refresh");
const demoReset = document.querySelector("#demo-reset");
const refreshLabel = document.querySelector(".refresh-label");
const refreshAnnouncement = document.querySelector("#refresh-announcement");
const lastUpdated = document.querySelector("#last-updated");
const decisionTotal = document.querySelector("#decision-total");
const countAllowed = document.querySelector("#count-allowed");
const countDenied = document.querySelector("#count-denied");
const countError = document.querySelector("#count-error");
const decisionCounts = document.querySelector("#decision-counts");
const accessStatusRequest = document.querySelector("#access-status-request");
const accessStatusSummary = document.querySelector("#access-status-summary");
const accessStatusResult = document.querySelector("#access-status-result");
const accessStatusDescription = document.querySelector(
  "#access-status-description",
);
const accessStatusBadge = document.querySelector("#access-status-badge");
const accessStatusStage = document.querySelector("#access-status-stage");
const accessStatusPolicy = document.querySelector("#access-status-policy");
const accessStatusCredentials = document.querySelector(
  "#access-status-credentials",
);
const accessStatusAction = document.querySelector("#access-status-action");
const stageDialog = document.querySelector("#stage-dialog");
const stageDialogEyebrow = document.querySelector("#stage-dialog-eyebrow");
const stageDialogTitle = document.querySelector("#stage-dialog-title");
const stageDialogSummary = document.querySelector("#stage-dialog-summary");
const stageDialogState = document.querySelector("#stage-dialog-state");
const stageDialogTime = document.querySelector("#stage-dialog-time");
const stageDialogAction = document.querySelector("#stage-dialog-action");
const stageDialogCode = document.querySelector("#stage-dialog-code");
const stageCodeCopy = document.querySelector("#stage-code-copy");
const stageDialogSubsteps = document.querySelector("#stage-dialog-substeps");
const stageDialogChecks = document.querySelector("#stage-dialog-checks");
const stageDialogDestinationTitle = document.querySelector(
  "#stage-dialog-destination-title",
);
const stageDialogDestinationNote = document.querySelector(
  "#stage-dialog-destination-note",
);
const stageDialogOpenLink = document.querySelector("#stage-dialog-open-link");
const stageDialogOpenLinkLabel = document.querySelector(
  "#stage-dialog-open-link-label",
);
const stageDialogOpenAction = document.querySelector(
  "#stage-dialog-open-action",
);
const stageDialogSecondaryAction = document.querySelector(
  "#stage-dialog-secondary-action",
);
const stageCodeViewButtons = document.querySelectorAll(
  "[data-stage-code-view]",
);
const pathSteps = {
  verify: document.querySelector("#path-step-verify"),
  agent: document.querySelector("#path-step-agent"),
  obo: document.querySelector("#path-step-obo"),
  gateway: document.querySelector("#path-step-gateway"),
  mcp: document.querySelector("#path-step-mcp"),
  vault: document.querySelector("#path-step-vault"),
  database: document.querySelector("#path-step-database"),
};

const defaultTraceMarkup = trace.innerHTML;
const defaultConversationMarkup = conversation.innerHTML;
const themeStorageKey = "bob-vault-demo-theme";
const suggestionLimit = 6;
const protectedSuggestionPool = [
  {
    label: "주문 ORD-1001 상태 확인",
    prompt: "주문 ORD-1001 상태를 확인해줘",
    icon: "icon-delivery",
  },
  {
    label: "주문 ORD-1002 상태 확인",
    prompt: "주문 ORD-1002 상태를 확인해줘",
    icon: "icon-delivery",
  },
  {
    label: "주문 ORD-1003 배송 현황",
    prompt: "주문 ORD-1003의 결제와 배송 상태를 알려줘",
    icon: "icon-delivery",
  },
  {
    label: "주문 ORD-1004 상태 확인",
    prompt: "주문 ORD-1004 상태를 확인해줘",
    icon: "icon-delivery",
  },
  {
    label: "최근 주문 5건 요약",
    prompt: "최근 주문 5건을 요약해줘",
    icon: "icon-cloud-auditing",
  },
  {
    label: "오늘 실패 결제 요약",
    prompt: "오늘 실패한 결제를 요약해줘",
    icon: "icon-chart-bar",
  },
  {
    label: "7일 실패 결제 추이",
    prompt: "최근 7일 실패 결제 통계를 보여줘",
    icon: "icon-chart-bar",
  },
  {
    label: "민감 정보 차단 확인",
    prompt: "CUS-1001의 민감 결제 정보를 보여줘",
    icon: "icon-locked",
  },
];
const guideSuggestionPool = [
  {
    label: "Lab 보안 흐름 안내",
    prompt: "이 Lab의 보안 흐름을 설명해줘",
    icon: "icon-security",
  },
  {
    label: "OBO 토큰 교환 설명",
    prompt: "사용자 JWT가 OBO 토큰으로 교환되는 과정을 설명해줘",
    icon: "icon-user-id",
  },
  {
    label: "Vault 동적 자격증명 설명",
    prompt: "Vault가 PostgreSQL 동적 자격증명을 발급하는 과정을 설명해줘",
    icon: "icon-locked",
  },
  {
    label: "권한 등급 차이 설명",
    prompt: "전체 사용자와 제한 사용자의 주문 조회 권한 차이를 설명해줘",
    icon: "icon-policy",
  },
  {
    label: "Gateway 역할 설명",
    prompt: "ContextForge Gateway가 이 Lab에서 수행하는 역할을 설명해줘",
    icon: "icon-network",
  },
  {
    label: "차단 시나리오 안내",
    prompt: "권한 없는 사용자의 데이터 요청이 어디에서 차단되는지 설명해줘",
    icon: "icon-warning",
  },
  {
    label: "최소 권한 정책 안내",
    prompt: "이 Lab이 최소 권한 원칙을 적용하는 방법을 설명해줘",
    icon: "icon-security-services",
  },
  {
    label: "자격증명 폐기 과정",
    prompt: "데이터 조회 후 동적 자격증명이 어떻게 폐기되는지 설명해줘",
    icon: "icon-renew",
  },
];
const allowedStatuses = new Set(["allowed", "denied", "error", "ok"]);
const toolLabels = {
  get_order_status: "주문 상태 조회",
  get_failed_payment_summary: "실패 결제 요약 조회",
  get_recent_orders: "최근 주문 조회",
  get_failed_payment_trend: "실패 결제 통계 조회",
  get_sensitive_payment_data: "민감 정보 정책 확인",
};
const statusLabels = {
  allowed: "허용",
  denied: "차단",
  error: "오류",
  ok: "정상",
};
const stageLabels = {
  transport: "MCP 전송",
  identity: "Verify 신원",
  gateway: "ContextForge Gateway",
  vault: "Vault 정책",
  database: "PostgreSQL",
  policy: "에이전트 정책",
};
const actionLabels = {
  mcp_user_jwt_authenticated: "MCP 사용자 JWT 인증",
  mcp_request_authenticated: "MCP 요청 인증",
  invalid_bearer_token: "잘못된 Bearer 토큰 차단",
  invalid_user_jwt: "잘못된 사용자 JWT 차단",
  invalid_obo_jwt: "잘못된 OBO JWT 차단",
  user_session_authenticated: "Verify 사용자 세션 인증",
  access_tier_audit_missing: "권한 등급 클레임 미설정 감지",
  access_tier_audit_orders_full: "전체 주문 권한 등급 감지",
  access_tier_audit_orders_limited: "제한 주문 권한 등급 감지",
  protected_data_requires_verify: "미승인 사용자의 보호 데이터 조회 차단",
  agent_plan_failed: "에이전트 계획 오류",
  verify_obo_token_exchanged: "Verify RFC 8693 OBO 토큰 교환",
  verify_obo_exchange_failed: "Verify OBO 토큰 교환 실패",
  contextforge_request_started: "ContextForge 도구 라우팅 시작",
  contextforge_obo_forwarded: "ContextForge OBO JWT 전달",
  contextforge_request_failed: "ContextForge 요청 실패",
  contextforge_upstream_discovery: "ContextForge MCP 도구 검색",
  mcp_obo_jwt_authenticated: "MCP OBO JWT 인증",
  mcp_obo_jwt_verified: "MCP OBO JWT 재검증",
  verify_jwt_validated: "Verify JWT 검증",
  dynamic_credentials_issued: "동적 DB 자격증명 발급",
  get_order_status: "주문 상태 조회",
  get_failed_payment_summary: "실패 결제 요약 조회",
  get_recent_orders: "최근 주문 조회",
  get_failed_payment_trend: "실패 결제 통계 조회",
  order_not_found_or_unauthorized: "주문 없음 또는 권한 범위 외",
  vault_policy_denied: "Vault 정책 거부",
  vault_policy_allowed: "Vault 정책 허용",
  pii_access_denied: "민감 정보 접근 차단",
  "database/creds/bob-payment-pii": "민감 결제 DB 역할 요청 차단",
};
const readOnlyQueries = {
  get_order_status: [
    "SELECT order_id, payment_status, delivery_status, updated_at",
    "FROM v_bob_order_status_<ACCESS_TIER>",
    "WHERE order_id = $1",
    "LIMIT 1;",
  ],
  get_failed_payment_summary: [
    "SELECT delivery_status, COUNT(*)::int AS count",
    "FROM v_bob_order_status_<ACCESS_TIER>",
    "WHERE payment_status = 'FAILED'",
    "  AND updated_at >= $1::date",
    "  AND updated_at < ($1::date + INTERVAL '1 day')",
    "GROUP BY delivery_status",
    "ORDER BY delivery_status",
    "LIMIT 20;",
  ],
  get_recent_orders: [
    "SELECT order_id, payment_status, delivery_status, updated_at",
    "FROM v_bob_order_status_<ACCESS_TIER>",
    "ORDER BY updated_at DESC",
    "LIMIT $1;",
  ],
  get_failed_payment_trend: [
    "SELECT (updated_at AT TIME ZONE 'Asia/Seoul')::date AS date,",
    "       COUNT(*)::int AS total_count,",
    "       COUNT(*) FILTER (WHERE payment_status = 'FAILED')::int AS failed_count",
    "FROM v_bob_order_status_<ACCESS_TIER>",
    "WHERE updated_at >= CURRENT_DATE - ($1::int - 1)",
    "GROUP BY 1 ORDER BY 1;",
  ],
};
const toolExampleArguments = {
  get_order_status: { orderId: "ORD-1001" },
  get_failed_payment_summary: { date: "YYYY-MM-DD" },
  get_recent_orders: { limit: 5 },
  get_failed_payment_trend: { days: 7 },
};

const vaultTunnelCommand = String.raw`aws ssm start-session \
  --target "$VAULT_INSTANCE_ID" \
  --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["8200"],"localPortNumber":["8200"]}'`;

const stageDestinations = {
  verify: {
    title: "IBM Verify 관리 UI",
    note: "Verify 관리자 인증이 필요합니다. 토큰과 자격증명은 링크에 포함되지 않습니다.",
    label: "Verify UI 열기",
    href: "https://tenant.verify.ibm.com/ui/admin",
  },
  agent: {
    title: "현재 Agent 대화",
    note: "이 페이지의 대화 입력창으로 돌아가 Agent 계획과 응답을 계속 확인합니다.",
    label: "Agent 대화로 이동",
    action: "focus-agent",
  },
  obo: {
    title: "IBM Verify Token Exchange",
    note: "Agent가 사용자 Access Token을 subject_token으로 제출해 OBO JWT를 발급받는 Verify STS 단계입니다.",
    label: "Verify UI 열기",
    href: "https://tenant.verify.ibm.com/ui/admin",
  },
  gateway: {
    title: "IBM ContextForge MCP Gateway",
    note: "Gateway는 ECS Task 내부에만 배치되어 외부 UI를 노출하지 않습니다. 아래 링크는 오픈소스 프로젝트 정보입니다.",
    label: "ContextForge 프로젝트 보기",
    href: "https://github.com/IBM/mcp-context-forge",
  },
  mcp: {
    title: "MCP Server Inspector",
    note: "공개 상태·보안 제어·도구 카탈로그만 표시하는 읽기 전용 화면입니다.",
    label: "MCP Inspector 열기",
    href: "/mcp-inspector.html",
  },
  vault: {
    title: "HashiCorp Vault UI",
    note: "운영자 권한으로 Vault SSM 포트포워딩을 시작한 환경에서만 열립니다.",
    label: "Vault UI 열기",
    href: "https://127.0.0.1:8200/ui/",
    secondaryLabel: "터널 명령 복사",
    copyText: vaultTunnelCommand,
  },
  database: {
    title: "Amazon RDS · PostgreSQL",
    note: "AWS Console 권한이 필요합니다. DB는 private subnet에 있으며 공개 DB 관리 UI는 제공하지 않습니다.",
    label: "RDS 콘솔 열기",
    href: "https://ap-northeast-2.console.aws.amazon.com/rds/home?region=ap-northeast-2#database:id=bob-vault-nhi-demo-orders;is-cluster=false",
  },
};

const seoulTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

let csrfToken = "";
let isAuthenticatedUser = false;
let isApprovedUser = false;
let currentAccessTier = "unapproved";
let authorizationMode = "off";
let eventsRequestInFlight = false;
let eventsInterval = null;
let latestCredential = null;
let latestTool = "";
let stageDialogTrigger = null;
let activeRequestId = null;
let requestProgressInterval = null;
let currentStageDetail = null;
let lastSuggestionSignature = "";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function syncSuggestionAccessState() {
  document
    .querySelectorAll(".suggestions [data-protected='true']")
    .forEach((button) => {
      button.classList.toggle("requires-approval", !isApprovedUser);
      button.title = isApprovedUser
        ? "승인된 읽기 전용 데이터 요청"
        : "요청은 가능하지만 미승인 상태에서는 Agent가 조회를 차단합니다";
    });
}

function renderSuggestions() {
  if (!suggestions) return;
  let selected = [];
  let signature = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const protectedItems = shuffled(protectedSuggestionPool).slice(0, 4);
    const guideItems = shuffled(guideSuggestionPool).slice(
      0,
      suggestionLimit - protectedItems.length,
    );
    selected = shuffled([
      ...protectedItems.map((item) => ({ ...item, protected: true })),
      ...guideItems.map((item) => ({ ...item, protected: false })),
    ]);
    signature = selected.map((item) => item.prompt).join("|");
    if (signature !== lastSuggestionSignature) break;
  }
  lastSuggestionSignature = signature;

  suggestions.replaceChildren(
    ...selected.map((item) => {
      const button = element("button", "suggestion-item");
      button.type = "button";
      button.dataset.prompt = item.prompt;
      if (item.protected) button.dataset.protected = "true";
      const icon = element("span", `carbon-icon ${item.icon}`);
      icon.setAttribute("aria-hidden", "true");
      const copy = element("span", "suggestion-copy");
      copy.append(
        element(
          "small",
          "suggestion-type",
          item.protected ? "보호 데이터" : "Lab 안내",
        ),
        element("strong", "", item.label),
      );
      button.append(icon, copy);
      return button;
    }),
  );
  syncSuggestionAccessState();
}

function preferredTheme() {
  let saved = null;
  try {
    saved = window.localStorage.getItem(themeStorageKey);
  } catch {
    // Fall back to the operating-system theme when storage is unavailable.
  }
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  metaColorScheme?.setAttribute(
    "content",
    theme === "dark" ? "dark light" : "light dark",
  );
  themeToggle?.setAttribute("aria-pressed", String(theme === "dark"));
  themeToggle?.setAttribute(
    "aria-label",
    theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환",
  );
  if (themeToggleLabel) {
    themeToggleLabel.textContent =
      theme === "dark" ? "라이트 모드" : "다크 모드";
  }
  if (themeSymbol) themeSymbol.textContent = theme === "dark" ? "☾" : "☼";
}

function toggleTheme() {
  const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
  try {
    window.localStorage.setItem(themeStorageKey, nextTheme);
  } catch {
    // The theme still changes for the current page session.
  }
  applyTheme(nextTheme);
}

function setReadinessState(state) {
  readiness?.classList.remove("ready", "error");
  if (state) readiness?.classList.add(state);
}

function formatAction(action) {
  const rawAction = String(action ?? "");
  if (Object.hasOwn(actionLabels, rawAction)) return actionLabels[rawAction];
  if (rawAction.startsWith("agent_plan_")) return "에이전트 실행 계획 수립";
  if (rawAction.startsWith("agent_response_")) return "에이전트 내부 응답 완료";
  return (
    rawAction.replaceAll("_", " ").replaceAll("/", " › ") || "알 수 없는 조치"
  );
}

function pathKeyForEvent(event) {
  const stage = String(event?.stage ?? "");
  const action = String(event?.action ?? "");
  if (stage === "identity") {
    if (action.startsWith("verify_obo_")) return "obo";
    if (action.startsWith("mcp_obo_")) return "mcp";
    return "verify";
  }
  return {
    policy: "agent",
    gateway: "gateway",
    transport: "mcp",
    vault: "vault",
    database: "database",
  }[stage];
}

function stageDetail(stage) {
  const activeTool = Object.hasOwn(toolLabels, latestTool)
    ? latestTool
    : "get_order_status";
  const catalog = {
    verify: {
      eyebrow: "01 · 사용자 신원",
      title: "IBM Verify",
      summary:
        "사용자의 로그인 세션과 JWT 서명을 검증하고, 발급자·대상·만료 시간을 확인합니다.",
      action:
        "검증이 끝난 사용자 요청만 다음 단계로 전달합니다. 토큰 원문은 화면이나 로그에 표시하지 않습니다.",
      code: [
        "GET /v1.0/endpoint/default/jwks",
        "",
        "validate(userJwt, {",
        '  issuer: "https://tenant.verify.ibm.com/oidc/endpoint/default",',
        '  audience: "<chatbot-client-id>",',
        '  requiredClaims: ["sub", "exp", "iat"]',
        "});",
      ].join("\n"),
    },
    agent: {
      eyebrow: "02 · 에이전트 계획",
      title: "Bob AI 에이전트",
      summary:
        "사용자 문장에서 의도를 분류하고 허용된 읽기 전용 도구와 인자를 선택합니다.",
      action:
        "도구 허용 목록과 사용자 입력에 근거한 인자인지 확인합니다. 계획에 실패하면 규칙 기반 안전 모드로 전환합니다.",
      code: [
        "const plan = await planner.plan(message);",
        "",
        "assert(allowedTools.has(plan.tool));",
        "assert(isGrounded(plan.arguments, message));",
        "return plan;",
      ].join("\n"),
    },
    obo: {
      eyebrow: "03 · 위임 토큰 교환",
      title: "IBM Verify Token Exchange",
      summary:
        "Agent가 사용자 Access Token을 subject_token으로 제출하고 자신의 KMS 서명 신원을 결합해 MCP용 OBO JWT를 발급받습니다.",
      action:
        "RFC 8693 토큰 교환 후 issuer, audience, 사용자 subject와 Agent actor claim을 검증합니다.",
      code: [
        "POST /oauth2/token",
        "grant_type=urn:ietf:params:oauth:grant-type:token-exchange",
        "subject_token=<USER_ACCESS_TOKEN>",
        "client_assertion=<KMS_SIGNED_PRIVATE_KEY_JWT>",
        "audience=bob-vault-orders",
      ].join("\n"),
    },
    gateway: {
      eyebrow: "04 · MCP 게이트웨이",
      title: "IBM ContextForge",
      summary:
        "Agent 전용 사설 Gateway가 공개된 도구 카탈로그를 제한하고 MCP Server로 요청을 라우팅합니다.",
      action:
        "Gateway 세션으로 Agent 채널을 인증하고 OBO JWT는 X-Upstream-Authorization으로 MCP Server에 전달합니다.",
      code: [
        "POST /servers/<virtual-server-id>/mcp",
        "Authorization: Bearer <CONTEXTFORGE_SESSION>",
        "X-Upstream-Authorization: Bearer <OBO_JWT>",
      ].join("\n"),
    },
    mcp: {
      eyebrow: "05 · 도구 실행",
      title: "MCP Server",
      summary:
        "Gateway가 전달한 OBO JWT를 인증한 뒤 스키마가 고정된 MCP 도구 호출만 수락합니다.",
      action: `${toolLabels[activeTool]} 요청을 MCP tools/call 형식으로 만들고 입력 스키마를 다시 검증합니다.`,
      code: JSON.stringify(
        {
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: activeTool,
            arguments: toolExampleArguments[activeTool] ?? {},
          },
        },
        null,
        2,
      ),
    },
    vault: {
      eyebrow: "06 · 정책과 자격증명",
      title: "HashiCorp Vault",
      summary:
        "OBO JWT의 사용자·에이전트 클레임을 정책에 매핑하고 짧은 TTL의 DB 자격증명을 발급합니다.",
      action:
        "사용자 권한 등급에 맞는 읽기 전용 역할만 평가합니다. 민감 정보 역할은 정책 단계에서 차단됩니다.",
      code: [
        "POST /v1/auth/jwt/login",
        "X-Vault-Namespace: demo",
        "",
        "{",
        '  "role": "<bob-orders-full|bob-orders-limited>",',
        '  "jwt": "<OBO JWT>"',
        "}",
        "",
        "GET /v1/database/creds/<bob-orders-full|bob-orders-limited>",
      ].join("\n"),
    },
    database: {
      eyebrow: "07 · 데이터 접근",
      title: "PostgreSQL",
      summary:
        "Vault가 발급한 임시 계정으로 사전에 정의된 읽기 전용 SQL만 실행합니다.",
      action: `${toolLabels[activeTool]}에 대응하는 매개변수화된 쿼리를 실행하고 자격증명을 즉시 반환합니다.`,
      code: (
        readOnlyQueries[activeTool] ?? readOnlyQueries.get_order_status
      ).join("\n"),
    },
  };
  const base = catalog[stage];
  return base ? { ...base, ...richStageDetail(stage, activeTool) } : undefined;
}

function richStageDetail(stage, activeTool) {
  const toolName = toolLabels[activeTool];
  const toolArguments = toolExampleArguments[activeTool] ?? {};
  const details = {
    verify: {
      eyebrow: "01 · 사용자 신원",
      summary:
        "IBM Verify가 사용자를 인증하고 OIDC Authorization Code + PKCE로 사용자 Access Token을 발급합니다.",
      action:
        "Chatbot은 JWT 서명과 issuer, audience, subject, 만료 시간을 검증하고 토큰 원문은 화면이나 로그에 남기지 않습니다.",
      substeps: [
        [
          "OIDC Authorization Code + PKCE 요청",
          "브라우저가 code_challenge와 state를 포함해 Verify authorize endpoint로 이동합니다.",
          "USER · OIDC",
        ],
        [
          "Cloud Directory 사용자 인증",
          "Verify가 사용자 자격 증명과 로그인 정책을 확인하고 일회용 authorization code를 반환합니다.",
          "USER · AUTHN",
        ],
        [
          "사용자 access_token JWT 발급",
          "Chatbot이 code_verifier로 code를 교환하고 사용자 sub·iss·aud·exp가 포함된 access token을 받습니다.",
          "USER · JWT",
        ],
      ],
      checks: [
        ["사용자 토큰", "RS256 · sub/iss/aud/exp 검증"],
        ["로그인 흐름", "Authorization Code + PKCE"],
        ["세션", "HttpOnly · SameSite · CSRF 보호"],
        ["권한 범위", "openid profile vault.db.read"],
      ],
      codeViews: {
        request: [
          "GET /v1.0/endpoint/default/authorize?",
          "  response_type=code&client_id=<CHATBOT_CLIENT_ID>&",
          "  scope=openid%20profile%20vault.db.read&",
          "  code_challenge=<PKCE_SHA256>&code_challenge_method=S256",
        ].join("\n"),
        response: JSON.stringify(
          {
            access_token: "<USER_ACCESS_TOKEN_REDACTED>",
            token_type: "Bearer",
            expires_in: 900,
            verified_claims: {
              sub: "<VERIFY_USER_SUBJECT>",
              aud: "<CHATBOT_CLIENT_ID>",
              scope: "vault.db.read",
            },
          },
          null,
          2,
        ),
        execution: [
          "const user = await completeAuthorizationCodePkce(callback);",
          "await jwtVerify(user.accessToken, verifyUserJwks, {",
          "  issuer: VERIFY_USER_ISSUER,",
          "  audience: VERIFY_USER_CLIENT_ID,",
          '  algorithms: ["RS256"]',
          "});",
          "createEncryptedSession({ sub: user.sub, accessToken: user.accessToken });",
        ].join("\n"),
      },
    },
    agent: {
      substeps: [
        [
          "사용자 세션 컨텍스트 수신",
          "검증된 사용자 subject, scope, request ID만 실행 컨텍스트에 전달합니다.",
          "SESSION",
        ],
        [
          "의도와 엔터티 분석",
          "자연어 요청에서 주문 ID, 날짜, 조회 건수 등 허용된 인자를 추출합니다.",
          "INTENT",
        ],
        [
          "허용 도구 계획 수립",
          "계획 결과를 고정 MCP 도구 allowlist와 비교하고 쓰기·삭제 작업을 배제합니다.",
          "PLAN",
        ],
        [
          "입력 근거와 스키마 검증",
          "생성된 인자가 사용자 요청에 근거하고 도구별 Zod 스키마를 만족하는지 확인합니다.",
          "POLICY",
        ],
        [
          "실행 계획 감사 기록",
          "토큰이나 프롬프트 원문 없이 선택 도구와 request ID를 이벤트로 남깁니다.",
          "AUDIT",
        ],
      ],
      checks: [
        ["도구 범위", "읽기 전용 allowlist"],
        ["입력 검증", "요청 근거 + Zod 스키마"],
        ["실패 모드", "규칙 기반 안전 계획"],
        ["감사 추적", "request ID로 전 구간 연결"],
      ],
      codeViews: {
        request: JSON.stringify(
          {
            requestId: "<REQUEST_ID>",
            user: { sub: "<VERIFY_SUB>", scope: "vault.db.read" },
            message: "최근 주문 5건을 요약해줘",
          },
          null,
          2,
        ),
        response: JSON.stringify(
          {
            tool: activeTool,
            arguments: toolArguments,
            policy: "read-only",
            grounded: true,
          },
          null,
          2,
        ),
        execution: [
          "const plan = await planner.plan(message);",
          "assert(allowedTools.has(plan.tool));",
          "assert(isGrounded(plan.arguments, message));",
          "toolSchemas[plan.tool].parse(plan.arguments);",
          "audit.record({ requestId, stage: 'policy', tool: plan.tool });",
          "return plan;",
        ].join("\n"),
      },
    },
    obo: {
      eyebrow: "03 · 사용자 위임과 Agent NHI",
      substeps: [
        [
          "사용자 Access Token 준비",
          "검증된 사용자 Access Token을 RFC 8693 subject_token으로 사용합니다.",
          "SUBJECT TOKEN",
        ],
        [
          "Agent Client Assertion 생성",
          "Agent가 AWS KMS 비대칭 키로 private_key_jwt Client Assertion을 서명합니다.",
          "AGENT · NHI",
        ],
        [
          "Verify Token Endpoint 호출",
          "subject_token과 Agent Assertion을 제출해 audience=bob-vault-orders인 토큰을 요청합니다.",
          "RFC 8693",
        ],
        [
          "OBO Access Token 발급",
          "Verify가 사용자 subject와 Agent actor claim을 결합한 짧은 TTL의 JWT를 발급합니다.",
          "OBO JWT",
        ],
        [
          "OBO JWT 로컬 검증",
          "Agent가 JWKS 서명, issuer, audience, exp, 사용자 sub와 Agent binding을 확인합니다.",
          "VERIFY",
        ],
      ],
      checks: [
        ["Grant", "RFC 8693 Token Exchange"],
        ["Agent 인증", "AWS KMS private_key_jwt"],
        ["대상", "aud=bob-vault-orders"],
        ["Binding", "사용자 sub + Agent client_id"],
      ],
      codeViews: {
        request: [
          "POST /oauth2/token",
          "Content-Type: application/x-www-form-urlencoded",
          "",
          "grant_type=urn:ietf:params:oauth:grant-type:token-exchange",
          "subject_token=<USER_ACCESS_TOKEN>",
          "subject_token_type=urn:ietf:params:oauth:token-type:access_token",
          "client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
          "client_assertion=<KMS_SIGNED_PRIVATE_KEY_JWT>",
          "audience=bob-vault-orders&scope=vault.db.read",
        ].join("\n"),
        response: JSON.stringify(
          {
            access_token: "<OBO_ACCESS_TOKEN_REDACTED>",
            token_type: "Bearer",
            expires_in: 300,
            claims: {
              sub: "<VERIFY_USER_SUBJECT>",
              client_id: "<AGENT_CLIENT_ID>",
              aud: "bob-vault-orders",
            },
          },
          null,
          2,
        ),
        execution: [
          "const assertion = await kmsSigner.sign();",
          "const obo = await exchangeToken({",
          "  subjectToken: user.accessToken, clientAssertion: assertion,",
          '  audience: "bob-vault-orders", scope: "vault.db.read"',
          "});",
          "await verifyOboJwt(obo.access_token);",
          "assert(obo.sub === user.sub);",
          "assert(obo.client_id === AGENT_CLIENT_ID);",
        ].join("\n"),
      },
    },
    gateway: {
      eyebrow: "04 · 사설 MCP Gateway",
      substeps: [
        [
          "Agent 채널 인증",
          "Agent가 외부에 노출되지 않은 ContextForge에 전용 세션 JWT로 접속합니다.",
          "PRIVATE AUTH",
        ],
        [
          "Virtual Server 선택",
          "고정된 bob-vault-security-lab 서버와 등록된 읽기 전용 도구만 노출합니다.",
          "CATALOG",
        ],
        [
          "MCP 요청 라우팅",
          "JSON-RPC 요청을 사설 loopback MCP Server endpoint로 전달합니다.",
          "ROUTE",
        ],
        [
          "OBO JWT 전달",
          "OBO JWT를 X-Upstream-Authorization으로 분리해 MCP Server Authorization 헤더에 전달합니다.",
          "PASSTHROUGH",
        ],
        [
          "요청 추적 연결",
          "X-Request-Id를 유지해 Agent, Gateway, MCP, Vault 이벤트를 하나의 흐름으로 연결합니다.",
          "TRACE",
        ],
      ],
      checks: [
        ["배치", "ECS Task loopback 전용"],
        ["도구", "등록된 read-only catalog"],
        ["사용자 신원", "OBO JWT upstream 전달"],
        ["노출", "외부 ALB listener 없음"],
      ],
      codeViews: {
        request: [
          "POST /servers/c0ffee00cafe40008000000000000001/mcp",
          "Authorization: Bearer <CONTEXTFORGE_SESSION_JWT>",
          "X-Upstream-Authorization: Bearer <OBO_JWT>",
          "X-Request-Id: <REQUEST_ID>",
          "",
          JSON.stringify(
            {
              jsonrpc: "2.0",
              method: "tools/call",
              params: { name: activeTool, arguments: toolArguments },
            },
            null,
            2,
          ),
        ].join("\n"),
        response: JSON.stringify(
          {
            route: "bob-vault-mcp-upstream",
            virtualServer: "bob-vault-security-lab",
            forwardedIdentity: "OBO_JWT_REDACTED",
            status: "routed",
          },
          null,
          2,
        ),
        execution: [
          "const gatewayToken = await contextForge.loginAgent();",
          "await mcpClient.connect({",
          "  authorization: `Bearer ${gatewayToken}` ,",
          "  'x-upstream-authorization': `Bearer ${oboToken}` ,",
          "  'x-request-id': requestId",
          "});",
          "return mcpClient.callTool(plan.tool, plan.arguments);",
        ].join("\n"),
      },
    },
    mcp: {
      substeps: [
        [
          "Bearer OBO JWT 수신",
          "Authorization 헤더에서 OBO JWT를 추출하고 허용된 토큰 형식인지 확인합니다.",
          "TRANSPORT",
        ],
        [
          "OBO JWT 유효성 검증",
          "JWKS 서명·issuer·audience·exp와 Agent actor claim을 검증해 위조·만료 토큰을 차단합니다.",
          "JWT",
        ],
        [
          "JSON-RPC와 도구 스키마 검증",
          "tools/call 메서드, 도구 이름, 인자 타입과 범위를 고정 스키마로 다시 검사합니다.",
          "MCP",
        ],
        [
          "도구 서비스 실행",
          "검증이 끝난 도구만 Vault 동적 자격증명 경계로 전달합니다.",
          "TOOL",
        ],
        [
          "응답과 감사 이벤트 연결",
          "MCP 응답과 Vault 이벤트를 동일한 request ID로 연결합니다.",
          "TRACE",
        ],
      ],
      checks: [
        ["프로토콜", "MCP 2025-11-25 · JSON-RPC 2.0"],
        ["토큰", "RS256 · issuer/audience/exp/actor"],
        ["권한", "scope=vault.db.read"],
        ["도구", `${toolName} · 스키마 통과`],
      ],
      codeViews: {
        request: JSON.stringify(
          {
            jsonrpc: "2.0",
            id: "<REQUEST_ID>",
            method: "tools/call",
            params: { name: activeTool, arguments: toolArguments },
          },
          null,
          2,
        ),
        response: JSON.stringify(
          {
            jsonrpc: "2.0",
            id: "<REQUEST_ID>",
            result: {
              content: [{ type: "text", text: "<SANITIZED_TOOL_RESULT>" }],
              isError: false,
            },
          },
          null,
          2,
        ),
        execution: [
          "const claims = await verifyOboJwt(bearerToken, {",
          '  audience: "bob-vault-orders", scope: "vault.db.read",',
          "  actorClaim: 'client_id'",
          "});",
          "const input = toolSchemas[request.params.name].parse(",
          "  request.params.arguments",
          ");",
          "return toolService.execute(request.params.name, input, claims);",
        ].join("\n"),
      },
    },
    vault: {
      substeps: [
        [
          "Vault JWT Auth 로그인",
          "OBO JWT와 access_tier에 맞는 역할을 namespace의 JWT auth mount에 제출합니다.",
          "AUTH/JWT",
        ],
        [
          "JWT 역할과 bound claims 평가",
          "issuer, audience, scope, 사용자 subject와 Agent client_id를 역할 조건과 비교합니다.",
          "ROLE",
        ],
        [
          "최소 권한 정책 부여",
          "등급별 database/creds 경로의 read capability만 부여합니다.",
          "POLICY",
        ],
        [
          "민감 역할 분리와 차단",
          "bob-payment-pii 같은 민감 역할은 Agent 경로에서 사용할 수 없습니다.",
          "DENY",
        ],
        [
          "동적 PostgreSQL 계정 발급",
          "Database secrets engine이 짧은 TTL의 고유 사용자와 비밀번호를 생성합니다.",
          "LEASE",
        ],
        [
          "Vault 감사 로그 기록",
          "토큰·비밀번호를 HMAC 처리한 상태로 인증·정책·발급 이벤트를 기록합니다.",
          "AUDIT",
        ],
      ],
      checks: [
        ["JWT 역할", "bob-orders-full / limited · bound audience/claims"],
        ["정책", "DB read-only 경로만 허용"],
        ["자격증명", "요청별 동적 계정 · 짧은 TTL"],
        ["감사", "파일 audit device · 민감값 HMAC"],
      ],
      codeViews: {
        request: [
          "POST /v1/auth/jwt/login",
          "X-Vault-Namespace: demo",
          "",
          '{ "role": "<TIERED_VAULT_ROLE>", "jwt": "<OBO_JWT_REDACTED>" }',
          "",
          "GET /v1/database/creds/<TIERED_DATABASE_ROLE>",
          "X-Vault-Token: <WRAPPED_VAULT_TOKEN>",
        ].join("\n"),
        response: JSON.stringify(
          {
            lease_id: "database/creds/<TIERED_DATABASE_ROLE>/<LEASE_ID>",
            lease_duration: 60,
            renewable: false,
            data: {
              username: "v-token-bob-<RANDOM>",
              password: "<DYNAMIC_PASSWORD_REDACTED>",
            },
          },
          null,
          2,
        ),
        execution: [
          'path "database/creds/<TIERED_DATABASE_ROLE>" {',
          '  capabilities = ["read"]',
          "}",
          'bound_audiences = ["bob-vault-orders"]',
          'bound_claims = { access_tier = "<orders-full|orders-limited>" }',
          'token_policies = ["<TIERED_VAULT_POLICY>"]',
          "token_ttl = 60",
        ].join("\n"),
      },
    },
    database: {
      substeps: [
        [
          "TLS 데이터베이스 연결",
          "Vault 동적 사용자로 private RDS endpoint에 암호화 연결을 생성합니다.",
          "TLS",
        ],
        [
          "읽기 전용 역할 확인",
          "동적 사용자는 허용 schema의 SELECT와 제한된 view 접근 권한만 가집니다.",
          "RBAC",
        ],
        [
          "고정·매개변수화 SQL 실행",
          "자연어를 SQL로 직접 바꾸지 않고 고정 쿼리에 검증된 인자만 바인딩합니다.",
          "QUERY",
        ],
        [
          "결과 최소화와 응답 정제",
          "행 수 제한과 허용 컬럼을 적용하고 MCP 응답 스키마로 직렬화합니다.",
          "OUTPUT",
        ],
        [
          "연결 종료와 자격증명 수명 종료",
          "연결을 닫고 자격증명을 폐기하며 lease는 TTL 만료 또는 revoke로 종료됩니다.",
          "REVOKE",
        ],
      ],
      checks: [
        ["네트워크", "Private subnet · TLS 연결"],
        ["DB 역할", "SELECT · 제한된 view"],
        ["SQL", "고정 statement · parameter binding"],
        ["수명", "연결 종료 · lease TTL/revoke"],
      ],
      codeViews: {
        request: JSON.stringify(
          {
            role: "<bob_orders_full_reader|bob_orders_limited_reader>",
            username: "<DYNAMIC_USERNAME>",
            ssl: { rejectUnauthorized: true },
            query: activeTool,
            parameters: toolArguments,
          },
          null,
          2,
        ),
        response: JSON.stringify(
          {
            rows: [
              {
                order_id: "ORD-1001",
                payment_status: "PAID",
                delivery_status: "IN_TRANSIT",
                updated_at: "<TIMESTAMP>",
              },
            ],
            rowCount: 1,
            credentialState: "released",
          },
          null,
          2,
        ),
        execution: (
          readOnlyQueries[activeTool] ?? readOnlyQueries.get_order_status
        ).join("\n"),
      },
    },
  };

  let detail = details[stage];
  if (!isApprovedUser && stage === "verify") {
    detail = {
      ...detail,
      summary:
        "현재 브라우저에는 IBM Verify 사용자 세션이 없습니다. 챗봇 안내는 사용할 수 있지만 보호 데이터용 사용자 JWT는 발급되지 않은 상태입니다.",
      action:
        "일반 안내 요청은 Agent로 전달하고, 데이터 조회 요청은 사용자 JWT 없이 MCP 경계로 전달하지 않습니다.",
      substeps: [
        [
          "공개 챗봇 세션 확인",
          "서버가 Verify 세션 쿠키가 없음을 확인하고 미승인 사용자 컨텍스트를 생성합니다.",
          "PUBLIC CHAT",
        ],
        [
          "사용자 JWT 미발급",
          "OIDC 로그인과 access token 발급을 수행하지 않았으므로 보호 데이터 권한은 부여되지 않습니다.",
          "NO JWT",
        ],
        [
          "최소 권한 상태 유지",
          "MCP에 전달할 Bearer 토큰, Vault OBO JWT, DB 자격증명은 생성하지 않습니다.",
          "DENY BY DEFAULT",
        ],
      ],
      checks: [
        ["챗봇", "일반 안내 사용 가능"],
        ["Verify 세션", "없음"],
        ["보호 데이터", "조회 불가"],
        ["후속 경계", "MCP·Vault·DB 토큰 미발급"],
      ],
      codeViews: {
        request: JSON.stringify(
          {
            authenticated: false,
            authorization: "unapproved",
            capability: "general-chat-only",
          },
          null,
          2,
        ),
        response: JSON.stringify(
          {
            user: "미승인 사용자",
            chat: "allowed",
            protectedData: "denied",
          },
          null,
          2,
        ),
        execution: [
          "const session = await readVerifySession(cookie);",
          "if (!session) {",
          "  return { authorization: 'unapproved', chat: 'allowed' };",
          "}",
        ].join("\n"),
      },
    };
  } else if (!isApprovedUser && stage === "agent") {
    detail = {
      ...detail,
      summary:
        "Agent가 미승인 사용자의 요청을 일반 안내와 보호 데이터 작업으로 분류합니다. 데이터 작업은 이 단계에서 차단합니다.",
      action:
        "보호 데이터 계획이면 `protected_data_requires_verify` 결정을 기록하고 MCP 호출 전에 반환합니다.",
      substeps: [
        [
          "미승인 사용자 컨텍스트 수신",
          "access token이 없는 공개 챗봇 사용자 상태로 요청을 받습니다.",
          "UNAPPROVED",
        ],
        [
          "요청 의도 분류",
          "Lab 안내인지 주문·결제 데이터 조회인지 고정 스키마로 분류합니다.",
          "INTENT",
        ],
        [
          "보호 데이터 권한 검사",
          "데이터 도구 계획에는 승인된 Verify 사용자 access token이 반드시 있어야 합니다.",
          "POLICY",
        ],
        [
          "MCP 이전 차단",
          "권한이 없으면 MCP, Vault, PostgreSQL을 호출하지 않고 안전한 거부 응답을 만듭니다.",
          "SHORT CIRCUIT",
        ],
        [
          "감사 이벤트 기록",
          "토큰이나 메시지 원문 없이 request ID와 차단 사유만 기록합니다.",
          "AUDIT",
        ],
      ],
      checks: [
        ["일반 안내", "허용"],
        ["데이터 조회", "Verify 승인 필수"],
        ["MCP 호출", "0회"],
        ["감사 결정", "protected_data_requires_verify"],
      ],
      codeViews: {
        request: JSON.stringify(
          {
            requestId: "<REQUEST_ID>",
            principal: { authorization: "unapproved" },
            message: "주문 ORD-1001 상태를 확인해줘",
          },
          null,
          2,
        ),
        response: JSON.stringify(
          {
            status: "denied",
            reason: "protected_data_requires_verify",
            downstream: { mcp: false, vault: false, database: false },
          },
          null,
          2,
        ),
        execution: [
          "const plan = await planner.plan(message);",
          "if (planUsesMcp(plan) && !principal.accessToken) {",
          "  audit.record('protected_data_requires_verify');",
          "  return denyBeforeMcp();",
          "}",
        ].join("\n"),
      },
    };
  }
  if (!detail) return {};
  return {
    ...detail,
    substeps: detail.substeps.map(([title, description, tag]) => ({
      title,
      description,
      tag,
    })),
  };
}

function openStageDialog(stage, trigger) {
  const detail = stageDetail(stage);
  const step = pathSteps[stage];
  if (!detail || !step || !stageDialog) return;

  const state =
    step.querySelector(".path-state")?.textContent?.trim() || "대기";
  const time = step.querySelector("time")?.textContent?.trim() || "—";
  stageDialogTrigger = trigger;
  stageDialogEyebrow.textContent = detail.eyebrow;
  stageDialogTitle.textContent = detail.title;
  stageDialogSummary.textContent = detail.summary;
  stageDialogState.textContent = state;
  stageDialogState.className = `stage-modal-state ${
    step.classList.contains("denied")
      ? "denied"
      : step.classList.contains("active") ||
          state === "성공" ||
          state === "허용"
        ? "allowed"
        : "waiting"
  }`;
  stageDialogTime.textContent = time;
  stageDialogAction.textContent = detail.action;
  stageDialogSubsteps.replaceChildren();
  detail.substeps.forEach((substep, index) => {
    const item = document.createElement("li");
    const copy = element("div", "stage-substep-copy");
    copy.append(
      element("strong", "", substep.title),
      element("p", "", substep.description),
    );
    item.append(
      element("span", "stage-substep-index", String(index + 1)),
      copy,
      element("span", "stage-substep-tag", substep.tag),
    );
    stageDialogSubsteps.append(item);
  });
  stageDialogChecks.replaceChildren();
  detail.checks.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.append(element("dt", "", label), element("dd", "", value));
    stageDialogChecks.append(row);
  });
  currentStageDetail = detail;
  renderStageCodeView("request");
  renderStageDestination(stage);
  stageCodeCopy.textContent = "코드 복사";
  stageDialog.showModal();
}

function renderStageDestination(stage) {
  const destination = stageDestinations[stage];
  if (!destination) return;

  stageDialogDestinationTitle.textContent = destination.title;
  stageDialogDestinationNote.textContent = destination.note;
  stageDialogOpenLink.hidden = !destination.href;
  stageDialogOpenAction.hidden = !destination.action;
  stageDialogSecondaryAction.hidden = !destination.copyText;

  if (destination.href) {
    stageDialogOpenLink.href = destination.href;
    stageDialogOpenLinkLabel.textContent = destination.label;
  } else {
    stageDialogOpenLink.removeAttribute("href");
  }

  if (destination.action) {
    stageDialogOpenAction.dataset.action = destination.action;
    stageDialogOpenAction.textContent = destination.label;
  } else {
    delete stageDialogOpenAction.dataset.action;
  }

  if (destination.copyText) {
    stageDialogSecondaryAction.dataset.copyText = destination.copyText;
    stageDialogSecondaryAction.textContent = destination.secondaryLabel;
  } else {
    delete stageDialogSecondaryAction.dataset.copyText;
  }
}

function renderStageCodeView(view) {
  if (!currentStageDetail?.codeViews?.[view]) return;
  stageDialogCode.textContent = currentStageDetail.codeViews[view];
  stageCodeViewButtons.forEach((button) => {
    const selected = button.dataset.stageCodeView === view;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
}

function closeStageDialog() {
  if (!stageDialog?.open) return;
  stageDialog.close();
}

function buildSummary(events) {
  const summary = {
    total: Array.isArray(events) ? events.length : 0,
    allowed: 0,
    denied: 0,
    error: 0,
  };

  if (!Array.isArray(events)) return summary;

  for (const event of events) {
    const status = String(event.status ?? "");
    if (status === "allowed" || status === "ok") {
      summary.allowed += 1;
    } else if (status === "denied") {
      summary.denied += 1;
    } else {
      summary.error += 1;
    }
  }

  return summary;
}

async function loadStatus() {
  try {
    const response = await fetch("/api/status", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("status unavailable");
    const status = await response.json();
    const safeVersion = String(status.version ?? "알 수 없음").slice(0, 32);
    serviceVersion.textContent = `버전 ${safeVersion}`;

    const isConfigured = Boolean(status.configured);
    previewStatus.textContent = isConfigured
      ? "서비스 구성 완료 · 챗봇 안내는 누구나, 보호 데이터 조회는 승인된 사용자만 사용할 수 있습니다."
      : "초기 설정이 아직 완료되지 않았습니다.";

    readiness.textContent = isConfigured
      ? "보안 제어 적용됨"
      : "초기 설정 필요";
    setReadinessState(isConfigured ? "ready" : "");
    mode.textContent = isConfigured
      ? "신원·권한 경로 구성 완료"
      : "IBM Verify 설정값 대기 중";
  } catch {
    serviceVersion.textContent = "버전 정보를 불러올 수 없음";
    previewStatus.textContent = "서비스 상태를 확인하지 못했습니다.";
    readiness.textContent = "상태 확인 불가";
    setReadinessState("error");
    mode.textContent = "서비스 상태 확인에 실패했습니다";
  }
}

async function loadSession() {
  const response = await fetch("/api/me", {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("session unavailable");
  }
  const session = await response.json();
  isAuthenticatedUser = Boolean(session.authenticated);
  isApprovedUser = session.authorization === "approved";
  currentAccessTier = String(session.accessTier ?? "unapproved");
  authorizationMode = String(session.authorizationMode ?? "off");
  csrfToken = isAuthenticatedUser ? String(session.csrfToken ?? "") : "";
  const displayName = String(session.user.displayName).slice(0, 80);
  userName.textContent = displayName;
  if (userInitial) {
    userInitial.textContent = initialsFor(displayName);
  }
  if (agentGreeting) {
    agentGreeting.textContent = `안녕하세요, ${displayName}님!`;
  }
  showWorkspace(isApprovedUser, isAuthenticatedUser);
  if (isAuthenticatedUser) {
    void runPreflight();
  } else {
    setPlanningState("fallback", "안전 안내 모드");
  }
}

async function redirectIfSessionExpired(response) {
  if (response.status !== 401 || !isAuthenticatedUser) return false;
  // A downstream OBO/MCP 401 does not invalidate the browser's login.
  try {
    const sessionResponse = await fetch("/api/me", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!sessionResponse.ok) return false;
    const session = await sessionResponse.json();
    if (session.authenticated !== false) return false;
  } catch {
    return false;
  }
  window.location.assign("/auth/login");
  return true;
}

function setPlanningState(kind, label) {
  if (!planningReadiness) return;
  planningReadiness.className = `planning-chip ${kind}`;
  planningReadiness.textContent = label;
}

async function runPreflight() {
  setPlanningState("checking", "계획 점검 중");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("/api/preflight", {
        method: "POST",
        headers: {
          accept: "application/json",
          "x-csrf-token": csrfToken,
        },
        signal: window.AbortSignal.timeout(35_000),
      });
      if (await redirectIfSessionExpired(response)) {
        return;
      }
      if (!response.ok) throw new Error("preflight unavailable");
      const status = await response.json();
      setPlanningState(
        status.mode === "enhanced" && status.ready ? "ready" : "fallback",
        status.mode === "enhanced" && status.ready
          ? "AI 계획 준비됨"
          : "안전 모드 준비됨",
      );
      return;
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
      }
    }
  }
  setPlanningState("fallback", "안전 모드 준비됨");
}

function initialsFor(displayName) {
  const words = displayName.trim().split(/\s+/u).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }
  return (words[0]?.slice(0, 2) || "U").toUpperCase();
}

function showLogin() {
  isAuthenticatedUser = false;
  isApprovedUser = false;
  currentAccessTier = "unapproved";
  authorizationMode = "off";
  csrfToken = "";
  resetUnauthenticatedDemo();
  userName.textContent = "미승인 사용자";
  userInitial.textContent = "미";
  agentGreeting.textContent = "안녕하세요.";
  showWorkspace(false);
}

function showWorkspace(approved = false, authenticated = false) {
  document.body.classList.add("authenticated");
  document.body.classList.toggle("approved-user", approved);
  identity.hidden = false;
  topnav.hidden = true;
  headerLogin.hidden = authenticated;
  logout.hidden = !authenticated;
  loginPanel.hidden = true;
  workspace.hidden = false;
  const limited = approved && currentAccessTier === "orders-limited";
  identityState.textContent = approved
    ? `Verify 인증 완료 · ${limited ? "제한 조회" : "조회 허용"}${authorizationMode === "audit" ? " · 감사 모드" : ""}`
    : authenticated
      ? "Verify 인증 완료 · 보호 데이터 권한 없음"
      : "미승인 · 보호 데이터 조회 불가";
  identityState.classList.toggle("unapproved", !approved);
  accessContext.textContent = approved
    ? `Verify 승인 · ${limited ? "제한 범위" : "읽기 전용"}`
    : authenticated
      ? "Verify 인증 · 권한 없음"
      : "챗봇 사용 가능 · 조회 불가";
  accessModeBanner.className = `access-mode-banner ${limited ? "limited" : approved ? "approved" : "unapproved"}`;
  accessModeIcon.className = `carbon-icon ${approved ? "icon-check-filled" : "icon-locked"}`;
  accessModeTitle.textContent = approved
    ? limited
      ? "제한 승인 사용자 모드"
      : "승인된 사용자 모드"
    : authenticated
      ? "인증 완료 · 보호 데이터 미승인"
      : "미승인 사용자 모드";
  accessModeDescription.textContent = approved
    ? limited
      ? "IBM Verify 인증과 제한 권한이 확인되었습니다. 담당 고객 범위의 주문 데이터만 조회할 수 있습니다."
      : `IBM Verify 인증이 완료되었습니다. 등록된 읽기 전용 도구로 보호 데이터를 조회할 수 있습니다.${authorizationMode === "audit" ? " 현재는 Verify 권한 클레임 적용 전 감사 모드입니다." : ""}`
    : authenticated
      ? "IBM Verify 로그인은 성공했지만 보호 데이터 권한이 없어 MCP·Vault·DB 호출 전에 차단됩니다."
      : "일반 대화와 Lab 안내는 사용할 수 있지만 주문·결제 데이터 조회는 Agent 단계에서 차단됩니다.";
  accessModeLogin.hidden = authenticated;
  demoReset.hidden = !authenticated;
  renderSuggestions();
  syncSuggestionAccessState();
  activeRequestId = null;
  resetTelemetryPath();
  renderCurrentAccessStatus([]);
  input.focus();
  if (!eventsInterval) {
    void loadEvents();
    eventsInterval = window.setInterval(loadEvents, 10_000);
  }
  if (window.location.hash === "#control-center") {
    window.requestAnimationFrame(() => {
      document
        .querySelector("#control-center")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function addMessage(kind, text, metadata) {
  const article = element(
    "article",
    `message ${kind === "user" ? "user-message" : "agent-message"}`,
  );
  const avatar = element(
    "div",
    `message-avatar ${kind === "user" ? "user-avatar" : "agent-avatar"}`,
    kind === "user" ? userInitial?.textContent || "U" : undefined,
  );
  if (kind !== "user") {
    avatar.textContent = "";
    const bob = document.createElement("img");
    bob.src = "/images/bob-head.png";
    bob.alt = "";
    bob.width = 32;
    bob.height = 32;
    avatar.append(bob);
  }
  avatar.setAttribute("aria-hidden", "true");
  const body = element("div", "message-body");
  const heading = element("div", "message-heading");
  heading.append(
    element(
      "span",
      "message-label",
      kind === "user" ? userName.textContent : "Bob AI 에이전트",
    ),
    element("time", "", seoulTimeFormatter.format(new Date())),
  );
  body.append(heading, element("p", "", text));
  if (metadata) {
    body.append(element("small", "message-meta", metadata));
  }
  article.append(avatar, body);
  conversation.append(article);
  scrollChatToBottom();
  return article;
}

function scrollChatToBottom(behavior = "smooth") {
  window.requestAnimationFrame(() => {
    chatScroll?.scrollTo({
      top: chatScroll.scrollHeight,
      behavior,
    });
  });
}

function appendQueryPreview(article, tool) {
  const lines = readOnlyQueries[tool];
  if (!lines) return;

  const result = element("section", "query-result");
  result.setAttribute("aria-label", "실행된 읽기 전용 SQL");
  const header = element("div", "query-result-header");
  header.append(element("span", "", "코드"));
  const copy = element("button", "", "복사");
  copy.type = "button";
  const query = lines.join("\n");
  copy.addEventListener("click", async () => {
    try {
      await window.navigator.clipboard.writeText(query);
      copy.textContent = "복사됨";
      window.setTimeout(() => (copy.textContent = "복사"), 1200);
    } catch {
      copy.textContent = "복사 불가";
    }
  });
  header.append(copy);
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = query;
  pre.append(code);
  result.append(header, pre);
  article.querySelector(".message-body")?.append(result);
}

function setBusy(busy) {
  input.disabled = busy;
  send.disabled = busy;
  conversation.setAttribute("aria-busy", String(busy));
  document
    .querySelectorAll(
      ".suggestions button, #shuffle-suggestions, .follow-up-suggestions button",
    )
    .forEach((button) => (button.disabled = busy));
}

function stopRequestProgressPolling() {
  if (!requestProgressInterval) return;
  window.clearInterval(requestProgressInterval);
  requestProgressInterval = null;
}

function startRequestProgressPolling() {
  stopRequestProgressPolling();
  void loadEvents();
  requestProgressInterval = window.setInterval(() => void loadEvents(), 250);
}

function addThinking() {
  const article = addMessage(
    "agent",
    "요청 의도와 허용된 권한 경로를 확인하고 있습니다…",
  );
  article.classList.add("thinking");
  article.setAttribute("role", "status");
  return article;
}

const defaultPathStates = {
  verify: { label: "대기", status: "neutral" },
  agent: { label: "대기", status: "neutral" },
  obo: { label: "대기", status: "neutral" },
  gateway: { label: "대기", status: "neutral" },
  mcp: { label: "대기", status: "neutral" },
  vault: { label: "대기", status: "neutral" },
  database: { label: "대기", status: "neutral" },
};

const pathOrder = [
  "verify",
  "agent",
  "obo",
  "gateway",
  "mcp",
  "vault",
  "database",
];
const activePathCopy = {
  verify: {
    label: "Verify 검증 중",
    state: "검증 중",
    detail: "IBM Verify 사용자 세션과 JWT 유효성을 확인하고 있습니다.",
  },
  agent: {
    label: "Agent 계획 중",
    state: "계획 중",
    detail: "Bob AI 에이전트가 의도와 허용된 도구 범위를 결정하고 있습니다.",
  },
  obo: {
    label: "OBO 교환 중",
    state: "교환 중",
    detail:
      "Agent가 Verify Token Endpoint에서 사용자 토큰을 MCP용 OBO JWT로 교환하고 있습니다.",
  },
  gateway: {
    label: "Gateway 라우팅 중",
    state: "라우팅 중",
    detail:
      "ContextForge가 등록된 도구를 확인하고 OBO JWT를 MCP Server로 전달하고 있습니다.",
  },
  mcp: {
    label: "MCP 실행 중",
    state: "실행 중",
    detail: "MCP Server가 OBO JWT와 도구 요청 스키마를 검증하고 있습니다.",
  },
  vault: {
    label: "Vault 평가 중",
    state: "평가 중",
    detail: "Vault가 OBO 신원과 읽기 전용 DB 역할 정책을 평가하고 있습니다.",
  },
  database: {
    label: "DB 조회 중",
    state: "조회 중",
    detail:
      "동적 자격증명으로 허용된 PostgreSQL 읽기 쿼리를 실행하고 있습니다.",
  },
};

const stageMotionClasses = [
  "motion-active",
  "motion-complete",
  "motion-stopped",
];

function applyStageMotion(node, nextState) {
  if (!node) return;
  const previousState = node.dataset.motionState ?? "neutral";
  if (previousState === nextState) return;
  node.classList.remove(...stageMotionClasses);
  node.dataset.motionState = nextState;

  const motionClass =
    nextState === "active"
      ? "motion-active"
      : nextState === "allowed"
        ? "motion-complete"
        : nextState === "denied" || nextState === "error"
          ? "motion-stopped"
          : "";
  if (motionClass) node.classList.add(motionClass);
}

function updatePathStep(
  key,
  label,
  status,
  time = "—",
  active = false,
  animateMotion = true,
) {
  const step = pathSteps[key];
  if (!step) return;
  step.classList.toggle("active", active);
  step.classList.toggle("complete", status === "allowed");
  step.classList.toggle("denied", status === "denied");
  step.classList.toggle("error", status === "error");
  const state = step.querySelector(".path-state");
  if (state) {
    state.textContent = label;
    state.className = `path-state ${status}`;
  }
  const timestamp = step.querySelector("time");
  if (timestamp) timestamp.textContent = time;

  const visualState = active ? "active" : status;
  if (animateMotion) applyStageMotion(step, visualState);
}

function resetVisiblePath(preserveMotionState = false) {
  for (const [key, value] of Object.entries(defaultPathStates)) {
    updatePathStep(key, value.label, value.status, "—", false, false);
  }
  if (!preserveMotionState) {
    for (const node of Object.values(pathSteps)) {
      if (!node) continue;
      node.classList.remove(...stageMotionClasses);
      node.dataset.motionState = "neutral";
    }
  }
}

function updatePathOverview(stage, state, detail) {
  const stageIndex = stage ? pathOrder.indexOf(stage) : -1;
  const currentValue =
    state === "complete"
      ? pathOrder.length
      : state === "response"
        ? 2
        : Math.max(stageIndex + 1, 0);
  const progressPercent =
    state === "waiting"
      ? 0
      : state === "complete"
        ? 100
        : state === "response"
          ? 40
          : ((Math.max(stageIndex, 0) + 0.65) / pathOrder.length) * 100;
  const overviewLabel =
    state === "waiting"
      ? "요청 대기"
      : state === "complete"
        ? "접근 완료"
        : state === "response"
          ? "응답 완료"
          : state === "denied"
            ? "요청 차단"
            : state === "error"
              ? "요청 오류"
              : activePathCopy[stage]?.label || "처리 중";

  traceStageCount.textContent =
    state === "waiting"
      ? `0/${String(pathOrder.length)}`
      : `${String(currentValue)}/${String(pathOrder.length)}`;
  traceLiveState.textContent = overviewLabel;
  traceLiveState.className = `live-state ${
    state === "complete" || state === "response" ? "verified" : state
  }`;
  traceStageDetail.textContent = detail;
  pathProgress.className = `path-progress ${state}`;
  pathProgress.setAttribute("aria-valuenow", String(currentValue));
  traceProgressFill.style.width = `${String(progressPercent)}%`;
}

function beginRequestPath() {
  resetVisiblePath();
  if (isApprovedUser) {
    updatePathStep("verify", activePathCopy.verify.state, "active", "—", true);
    updatePathOverview("verify", "active", activePathCopy.verify.detail);
  } else {
    updatePathStep(
      "verify",
      isAuthenticatedUser ? "인증 완료" : "미인증",
      isAuthenticatedUser ? "complete" : "neutral",
      "—",
    );
    updatePathStep("agent", activePathCopy.agent.state, "active", "—", true);
    updatePathOverview(
      "agent",
      "active",
      isAuthenticatedUser
        ? "Verify 인증은 성공했지만 보호 데이터 권한을 확인하고 있습니다."
        : "미승인 사용자 요청을 분류하고 보호 데이터 접근 여부를 확인합니다.",
    );
  }
  accessStatusSummary.className = "access-status-summary active";
  accessStatusBadge.className = "access-status-badge active";
  accessStatusRequest.textContent = "새 요청";
  accessStatusResult.textContent = isApprovedUser
    ? "사용자 신원 확인 중"
    : "요청 유형과 조회 권한 확인 중";
  accessStatusDescription.textContent = isApprovedUser
    ? "현재 요청의 Verify 신원부터 순서대로 평가합니다."
    : isAuthenticatedUser
      ? "Verify 인증 후 애플리케이션 권한을 별도로 평가합니다."
      : "일반 안내는 응답하고 보호 데이터 요청은 Agent에서 차단합니다.";
  accessStatusBadge.textContent = "처리 중";
  accessStatusStage.textContent = isApprovedUser ? "Verify 신원" : "Agent 정책";
  accessStatusPolicy.textContent = "평가 전";
  accessStatusCredentials.textContent = "미발급";
  accessStatusAction.textContent = isApprovedUser
    ? "사용자 세션 검증"
    : "요청 범위 분류";
}

function settleRequestFailure() {
  const failedStage =
    pathOrder.find((key) => pathSteps[key]?.classList.contains("active")) ??
    (isApprovedUser ? "verify" : "agent");
  const failedIndex = pathOrder.indexOf(failedStage);

  updatePathStep(failedStage, "오류", "error", "—");
  for (const key of pathOrder.slice(failedIndex + 1)) {
    updatePathStep(key, "미실행", "neutral");
  }
  updatePathOverview(
    failedStage,
    "error",
    `${activePathCopy[failedStage].label.replace(" 중", "")} 단계에서 오류가 발생해 요청을 중단했습니다. 이후 단계는 실행하지 않았습니다.`,
  );
  accessStatusSummary.className = "access-status-summary error";
  accessStatusBadge.className = "access-status-badge error";
  accessStatusResult.textContent = "요청을 처리하지 못했습니다";
  accessStatusDescription.textContent =
    "현재 단계에서 오류가 발생해 이후 접근 단계는 실행하지 않았습니다.";
  accessStatusBadge.textContent = "오류";
  accessStatusStage.textContent = activePathCopy[failedStage].label.replace(
    " 중",
    "",
  );
  accessStatusPolicy.textContent = "평가 중단";
  accessStatusCredentials.textContent = "미발급";
  accessStatusAction.textContent = "요청 중단";
}

function renderTrace(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    trace.innerHTML = defaultTraceMarkup;
    return;
  }

  trace.replaceChildren();

  for (const [index, step] of steps.entries()) {
    const item = document.createElement("li");
    const copy = document.createElement("div");
    copy.append(
      element(
        "strong",
        "",
        {
          "OBO JWT": "에이전트 OBO JWT",
          "Agent 정책": "에이전트 정책",
        }[step.label] ?? String(step.label),
      ),
      element("small", "", String(step.detail)),
    );
    const stateLabel = {
      verified: "검증",
      allowed: "허용",
      issued: "발급",
      denied: "차단",
    }[step.status];
    item.append(
      element("span", "trace-index", String(index + 1).padStart(2, "0")),
      copy,
      element(
        "span",
        `trace-state ${String(step.status)}`,
        stateLabel ?? "확인",
      ),
    );
    trace.append(item);
  }
}

async function sendMessage(message) {
  const trimmed = message.trim();
  if (!trimmed) return;
  const retryValue = trimmed;
  addMessage("user", trimmed);
  input.value = "";
  input.style.height = "";
  activeRequestId = window.crypto.randomUUID();
  beginRequestPath();
  startRequestProgressPolling();
  setBusy(true);
  const thinking = addThinking();
  try {
    const headers = {
      accept: "application/json",
      "content-type": "application/json",
      "x-request-id": activeRequestId,
    };
    if (isAuthenticatedUser) headers["x-csrf-token"] = csrfToken;
    const response = await fetch("/api/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({ message: trimmed }),
    });
    if (await redirectIfSessionExpired(response)) {
      return;
    }
    const payload = await response.json();
    if (!response.ok) {
      activeRequestId =
        String(payload?.error?.requestId ?? "") || activeRequestId;
      if (activeRequestId) void loadEvents();
      throw new Error(payload?.error?.message ?? "요청을 완료하지 못했습니다.");
    }
    activeRequestId = String(payload.requestId ?? "") || activeRequestId;
    thinking.remove();
    const traceSteps = Array.isArray(payload.trace) ? payload.trace : [];
    const deniedByPolicy = traceSteps.some(
      (step) => String(step.status) === "denied",
    );
    const restrictedByDataScope = traceSteps.some(
      (step) =>
        String(step.status) === "denied" &&
        String(step.label) === "PostgreSQL 데이터 범위",
    );
    const responseMessage = addMessage(
      "agent",
      String(payload.reply),
      payload.tool && restrictedByDataScope
        ? `권한 범위 외 · 데이터 미반환 · 요청 ${String(payload.requestId).slice(0, 8)}`
        : payload.tool && deniedByPolicy
          ? `보호 데이터 조회 차단 · 요청 ${String(payload.requestId).slice(0, 8)}`
          : payload.tool
            ? `MCP 도구 · ${toolLabels[String(payload.tool)] ?? String(payload.tool)} · 요청 ${String(payload.requestId).slice(0, 8)}`
            : "에이전트 정책 안내",
    );
    latestTool = deniedByPolicy ? "" : String(payload.tool ?? "");
    if (!deniedByPolicy) {
      appendQueryPreview(responseMessage, String(payload.tool ?? ""));
    }
    appendFollowUpSuggestions(responseMessage, payload.suggestions);
    renderTrace(traceSteps);
    if (payload.credential?.state === "released") {
      const ttl = Number(payload.credential.initialTtlSeconds);
      if (Number.isFinite(ttl) && ttl > 0) {
        latestCredential = `사용 종료 · 최초 TTL ${String(ttl)}초`;
        accessStatusCredentials.textContent = latestCredential;
      }
    } else if (payload.tool === "get_sensitive_payment_data") {
      latestCredential = null;
    }
    void loadEvents();
  } catch (error) {
    thinking.remove();
    settleRequestFailure();
    if (!input.value) input.value = retryValue;
    const failureMessage = addMessage(
      "agent",
      error instanceof Error
        ? error.message
        : "요청을 안전하게 완료하지 못했습니다.",
      "요청 실패",
    );
    appendFollowUpSuggestions(failureMessage, [
      { label: "다시 시도", prompt: retryValue },
    ]);
  } finally {
    stopRequestProgressPolling();
    void loadEvents();
    setBusy(false);
    input.focus();
  }
}

function appendFollowUpSuggestions(article, values) {
  if (!Array.isArray(values) || values.length === 0) return;
  const suggestions = element("div", "follow-up-suggestions");
  suggestions.setAttribute("aria-label", "후속 질문");
  for (const value of values.slice(0, 3)) {
    const label = String(value?.label ?? "")
      .trim()
      .slice(0, 40);
    const prompt = String(value?.prompt ?? "")
      .trim()
      .slice(0, 500);
    if (!label || !prompt) continue;
    const button = element("button", "", label);
    button.type = "button";
    button.dataset.prompt = prompt;
    suggestions.append(button);
  }
  if (suggestions.childElementCount > 0) {
    article.querySelector(".message-body")?.append(suggestions);
  }
}

function latestRequestEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return [];
  const latestRequestId = String(events[0]?.requestId ?? "");
  return latestRequestId
    ? events.filter(
        (event) => String(event.requestId ?? "") === latestRequestId,
      )
    : events.slice(0, 1);
}

function eventsForActiveRequest(events) {
  if (!activeRequestId || !Array.isArray(events)) return [];
  return events.filter(
    (event) => String(event.requestId ?? "") === activeRequestId,
  );
}

function renderCurrentAccessStatus(
  events,
  loadFailed = false,
  summaryEvents = events,
) {
  const summary = buildSummary(summaryEvents);
  decisionTotal.textContent = `${summary.total}건`;
  countAllowed.textContent = String(summary.allowed);
  countDenied.textContent = String(summary.denied);
  countError.textContent = String(summary.error);
  decisionCounts.setAttribute(
    "aria-label",
    `최근 보안 이벤트 ${String(summary.total)}건, 허용 ${String(summary.allowed)}건, 차단 ${String(summary.denied)}건, 오류 ${String(summary.error)}건`,
  );

  const requestEvents = latestRequestEvents(events);
  if (loadFailed || requestEvents.length === 0) {
    const kind = loadFailed ? "error" : "waiting";
    accessStatusSummary.className = `access-status-summary ${kind}`;
    accessStatusBadge.className = `access-status-badge ${kind}`;
    accessStatusRequest.textContent = loadFailed
      ? "상태 확인 실패"
      : "요청 대기";
    accessStatusResult.textContent = loadFailed
      ? "접근 상태를 확인하지 못했습니다"
      : "요청 대기 중";
    accessStatusDescription.textContent = loadFailed
      ? "보안 이벤트를 불러오지 못했습니다. 잠시 후 새로고침해 주세요."
      : "요청을 보내면 현재 신원·권한·데이터베이스 접근 상태를 표시합니다.";
    accessStatusBadge.textContent = loadFailed ? "오류" : "대기";
    accessStatusStage.textContent = loadFailed ? "확인 필요" : "대기";
    accessStatusPolicy.textContent = loadFailed ? "확인 필요" : "평가 전";
    accessStatusCredentials.textContent = loadFailed ? "확인 필요" : "미발급";
    accessStatusAction.textContent = loadFailed
      ? "이벤트 조회 실패"
      : "기록 없음";
    accessStatusAction.removeAttribute("title");
    accessStatusSummary.setAttribute(
      "aria-label",
      `${accessStatusResult.textContent}. ${accessStatusDescription.textContent}`,
    );
    return;
  }

  const terminalEvent =
    requestEvents.find((event) => {
      const status = String(event.status ?? "");
      return status === "denied" || (status !== "allowed" && status !== "ok");
    }) ?? requestEvents[0];
  const terminalStatus = String(terminalEvent?.status ?? "");
  const deniedEvent = terminalStatus === "denied" ? terminalEvent : null;
  const errorEvent =
    terminalStatus !== "allowed" &&
    terminalStatus !== "ok" &&
    terminalStatus !== "denied"
      ? terminalEvent
      : null;
  const databaseSuccess = requestEvents.some((event) => {
    const status = String(event.status ?? "");
    return (
      String(event.stage ?? "") === "database" &&
      (status === "allowed" || status === "ok")
    );
  });
  const responseOnly = requestEvents.some(
    (event) =>
      String(event.stage ?? "") === "policy" &&
      String(event.action ?? "").startsWith("agent_response_"),
  );
  const credentialsIssued = requestEvents.some(
    (event) =>
      String(event.action ?? "") === "dynamic_credentials_issued" ||
      (String(event.stage ?? "") === "database" &&
        ["allowed", "ok"].includes(String(event.status ?? ""))),
  );
  const stageKey = String(terminalEvent?.stage ?? "");
  const stage = stageLabels[stageKey] ?? "보안 제어";
  const requestId = String(requestEvents[0]?.requestId ?? "");
  const eventDate = new Date(requestEvents[0]?.at);
  const eventTime = Number.isNaN(eventDate.getTime())
    ? "시각 정보 없음"
    : seoulTimeFormatter.format(eventDate);

  let kind = "active";
  if (deniedEvent) kind = "denied";
  else if (errorEvent) kind = "error";
  else if (databaseSuccess) kind = "allowed";
  else if (responseOnly) kind = "response";

  const completedStages = new Set(
    requestEvents
      .filter((event) => ["allowed", "ok"].includes(String(event.status)))
      .map((event) => pathKeyForEvent(event))
      .filter(Boolean),
  );
  const nextStageKey = pathOrder.find((key) => !completedStages.has(key));
  const currentStage =
    kind === "active" && nextStageKey
      ? {
          verify: "Verify 신원",
          agent: "에이전트 계획",
          obo: "Verify OBO 교환",
          gateway: "ContextForge Gateway",
          mcp: "MCP 도구",
          vault: "Vault 정책",
          database: "PostgreSQL",
        }[nextStageKey]
      : stage;

  const deniedResultByStage = {
    gateway: "ContextForge Gateway에서 요청 차단",
    transport: "MCP 인증 단계에서 접근 차단",
    identity: "Verify 신원 검증에서 접근 차단",
    policy: "에이전트 정책으로 요청 차단",
    vault: "Vault 최소 권한 정책으로 접근 차단",
    database: "PostgreSQL 접근 단계에서 요청 차단",
  };
  const deniedDescriptionByStage = {
    gateway:
      "ContextForge가 Agent 채널이나 등록된 도구 범위를 허용하지 않아 MCP Server 이전에 요청을 중단했습니다.",
    transport:
      "MCP가 사용자 토큰을 검증하지 못해 요청을 중단했습니다. Vault와 PostgreSQL에는 도달하지 않았습니다.",
    identity:
      "IBM Verify 신원 또는 OBO 토큰 검증에 실패해 요청을 중단했습니다. Vault 권한은 평가되지 않았습니다.",
    policy:
      "에이전트 정책이 요청 범위를 허용하지 않아 중단했습니다. Vault와 PostgreSQL에는 도달하지 않았습니다.",
    vault: credentialsIssued
      ? "Vault 정책이 요청을 차단했습니다. 발급된 자격증명은 데이터 접근에 사용되지 않았습니다."
      : "Vault 정책이 요청을 차단했습니다. PostgreSQL 자격증명은 발급되지 않았습니다.",
    database: credentialsIssued
      ? "PostgreSQL 접근 단계에서 요청을 차단했습니다. 발급된 자격증명은 데이터 조회에 사용되지 않았습니다."
      : "PostgreSQL 접근 단계에서 요청을 차단했습니다. 자격증명은 발급되지 않았습니다.",
  };
  const preVaultStages = new Set([
    "transport",
    "identity",
    "gateway",
    "policy",
  ]);
  const deniedPolicy = preVaultStages.has(stageKey)
    ? "평가 전"
    : stageKey === "vault"
      ? "정책 차단"
      : "평가 완료";
  const protectedDataDenied = requestEvents.some(
    (event) => String(event.action ?? "") === "protected_data_requires_verify",
  );
  const scopedDataRestriction = requestEvents.some(
    (event) =>
      String(event.stage ?? "") === "database" &&
      String(event.status ?? "") === "denied" &&
      String(event.action ?? "") === "order_not_found_or_unauthorized",
  );
  if (protectedDataDenied) {
    deniedResultByStage.policy = "미승인 사용자의 보호 데이터 조회 차단";
    deniedDescriptionByStage.policy =
      "챗봇 이용은 허용되지만 Verify 사용자 세션이 없어 데이터 조회를 중단했습니다. MCP, Vault, PostgreSQL은 호출하지 않았습니다.";
  }
  if (scopedDataRestriction) {
    deniedResultByStage.database = "주문 데이터 반환 제한";
    deniedDescriptionByStage.database =
      "Verify 인증과 OBO·Gateway·MCP·Vault 처리는 성공했지만, PostgreSQL 제한 뷰가 요청한 주문을 반환하지 않았습니다. 주문이 없거나 현재 권한 범위 밖인지는 구분해 공개하지 않습니다.";
  }
  const errorPolicy = preVaultStages.has(stageKey)
    ? "평가 전"
    : stageKey === "vault"
      ? "평가 오류"
      : "평가 완료";

  const copyByKind = {
    active: {
      result: "접근 요청 처리 중",
      description: `${currentStage} 단계에서 요청을 처리하고 있습니다. 완료되면 권한과 자격증명 상태가 갱신됩니다.`,
      badge: "처리 중",
      policy: requestEvents.some(
        (event) => String(event.stage ?? "") === "vault",
      )
        ? "평가 중"
        : "평가 전",
      credentials: credentialsIssued ? "발급 완료" : "발급 전",
    },
    allowed: {
      result: "PostgreSQL 읽기 접근 허용",
      description:
        "Verify 사용자와 Bob OBO 신원이 검증되었고, Vault가 읽기 전용 데이터 접근을 허용했습니다.",
      badge: "허용",
      policy: "읽기 전용 허용",
      credentials: "발급·사용 완료",
    },
    response: {
      result: "에이전트 응답 완료",
      description:
        "Bob AI 에이전트가 내부 정책 안내로 응답했습니다. MCP, Vault, PostgreSQL은 호출하지 않았습니다.",
      badge: "완료",
      policy: "내부 응답",
      credentials: "미발급",
    },
    denied: {
      result: deniedResultByStage[stageKey] ?? `${stage} 단계에서 접근 차단`,
      description:
        deniedDescriptionByStage[stageKey] ??
        `${stage} 단계에서 요청을 차단했습니다. 이후 데이터 접근은 수행되지 않았습니다.`,
      badge: "차단",
      policy: protectedDataDenied
        ? "Verify 승인 필요"
        : scopedDataRestriction
          ? "제한 데이터 범위 적용"
          : deniedPolicy,
      credentials: scopedDataRestriction
        ? "발급·조회 후 폐기"
        : credentialsIssued
          ? "발급 후 사용 차단"
          : "미발급",
    },
    error: {
      result: "접근 처리 중 오류 발생",
      description: `${stage} 단계에서 처리 오류가 발생했습니다. 최근 보안 결정을 확인해 주세요.`,
      badge: "오류",
      policy: errorPolicy,
      credentials: credentialsIssued ? "발급 여부 확인" : "미발급",
    },
  };
  const copy = copyByKind[kind];
  const action = formatAction(requestEvents[0]?.action);

  accessStatusSummary.className = `access-status-summary ${kind}`;
  accessStatusBadge.className = `access-status-badge ${kind}`;
  accessStatusRequest.textContent = `${requestId ? `요청 ${requestId.slice(0, 8)}` : "최근 요청"} · ${eventTime}`;
  accessStatusResult.textContent = copy.result;
  accessStatusDescription.textContent = copy.description;
  accessStatusBadge.textContent = copy.badge;
  accessStatusStage.textContent = currentStage;
  accessStatusPolicy.textContent = copy.policy;
  accessStatusCredentials.textContent = copy.credentials;
  if (kind === "allowed" && latestCredential) {
    accessStatusCredentials.textContent = latestCredential;
  }
  accessStatusAction.textContent = action;
  accessStatusAction.title = action;
  accessStatusSummary.setAttribute(
    "aria-label",
    `${copy.result}. ${copy.description}`,
  );
}

function renderState(kind, message) {
  eventList.replaceChildren(element("li", `state ${kind}`, message));
}

function updatePathFromEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return;
  }
  resetVisiblePath(true);
  const requestEvents = latestRequestEvents(events);
  const unapprovedRequest = requestEvents.some(
    (event) =>
      String(event.action ?? "") === "protected_data_requires_verify" ||
      (String(event.stage ?? "") === "policy" &&
        String(event.action ?? "").startsWith("agent_response_") &&
        !requestEvents.some(
          (candidate) => String(candidate.stage ?? "") === "identity",
        )),
  );
  if (unapprovedRequest) {
    updatePathStep("verify", "미인증", "neutral", "—");
  }
  const eventsByPath = new Map();
  for (const event of requestEvents) {
    const key = pathKeyForEvent(event);
    if (key && !eventsByPath.has(key)) eventsByPath.set(key, event);
  }

  if (!eventsByPath.has("agent")) {
    const transportEvent = eventsByPath.get("mcp");
    const transportStatus = String(transportEvent?.status ?? "");
    if (transportStatus === "allowed" || transportStatus === "ok") {
      eventsByPath.set("agent", {
        ...transportEvent,
        stage: "policy",
        action: "agent_plan_inferred",
      });
    }
  }

  const terminalEvent = requestEvents.find((event) => {
    const status = String(event.status ?? "");
    return status === "denied" || (status !== "allowed" && status !== "ok");
  });
  const terminalKey = terminalEvent ? pathKeyForEvent(terminalEvent) : null;
  const scopedDataRestriction = requestEvents.some(
    (event) =>
      String(event.stage ?? "") === "database" &&
      String(event.status ?? "") === "denied" &&
      String(event.action ?? "") === "order_not_found_or_unauthorized",
  );
  const databaseComplete = requestEvents.some((event) => {
    const status = String(event.status ?? "");
    return (
      String(event.stage ?? "") === "database" &&
      (status === "allowed" || status === "ok")
    );
  });
  const responseOnly = requestEvents.some(
    (event) =>
      String(event.stage ?? "") === "policy" &&
      String(event.action ?? "").startsWith("agent_response_"),
  );
  const successfulKeys = new Set();

  for (const key of pathOrder) {
    const event = eventsByPath.get(key);
    if (!event) continue;
    const eventDate = new Date(event.at);
    const time = Number.isNaN(eventDate.getTime())
      ? "—"
      : seoulTimeFormatter.format(eventDate);
    const rawStatus = String(event.status ?? "error");
    const status =
      rawStatus === "allowed" || rawStatus === "ok"
        ? "allowed"
        : rawStatus === "denied"
          ? "denied"
          : "error";
    const label =
      status === "allowed"
        ? key === "vault"
          ? "허용"
          : "성공"
        : status === "denied"
          ? key === "database" &&
            String(event.action ?? "") === "order_not_found_or_unauthorized"
            ? "조회 제한"
            : "차단"
          : "오류";
    if (status === "allowed") successfulKeys.add(key);
    updatePathStep(key, label, status, time);
  }

  if (terminalEvent && terminalKey) {
    const terminalIndex = pathOrder.indexOf(terminalKey);
    for (const key of pathOrder.slice(terminalIndex + 1)) {
      updatePathStep(key, "미실행", "neutral");
    }
    const terminalStatus = String(terminalEvent.status ?? "");
    const terminalState = terminalStatus === "denied" ? "denied" : "error";
    updatePathOverview(
      terminalKey,
      terminalState,
      scopedDataRestriction
        ? "인증과 Vault 역할 부여는 성공했지만 PostgreSQL 제한 뷰에서 요청한 주문을 반환하지 않았습니다. 데이터는 노출되지 않았습니다."
        : terminalState === "denied"
          ? `${activePathCopy[terminalKey].label.replace(" 중", "")} 단계에서 요청을 차단했습니다. 이후 단계는 실행하지 않았습니다.`
          : `${activePathCopy[terminalKey].label.replace(" 중", "")} 단계에서 오류가 발생해 요청을 중단했습니다.`,
    );
    return;
  }

  if (databaseComplete) {
    updatePathOverview(
      "database",
      "complete",
      "Verify 로그인, OBO 교환, ContextForge, MCP, Vault와 PostgreSQL 단계를 모두 완료했습니다.",
    );
    return;
  }

  if (responseOnly) {
    if (unapprovedRequest) {
      updatePathStep("verify", "미인증", "neutral", "—");
    }
    for (const key of ["obo", "gateway", "mcp", "vault", "database"]) {
      updatePathStep(key, "미실행", "neutral");
    }
    updatePathOverview(
      "agent",
      "response",
      "에이전트가 내부 정책 안내로 응답했습니다. MCP, Vault, DB는 호출하지 않았습니다.",
    );
    return;
  }

  const nextStage = pathOrder.find((key) => !successfulKeys.has(key));
  if (nextStage) {
    const copy = activePathCopy[nextStage];
    updatePathStep(nextStage, copy.state, "active", "—", true);
    updatePathOverview(nextStage, "active", copy.detail);
  }
}

function resetTelemetryPath() {
  resetVisiblePath();
  updatePathOverview(
    null,
    "waiting",
    "요청을 보내면 실제 보안 이벤트에 맞춰 현재 단계가 이동합니다.",
  );
}

function renderEvents(events) {
  eventList.replaceChildren();
  if (!Array.isArray(events) || events.length === 0) {
    renderState("empty", "아직 기록된 보안 결정이 없습니다.");
    return;
  }

  for (const event of events) {
    const row = document.createElement("li");
    const eventDate = new Date(event.at);
    const timestamp = element(
      "time",
      "",
      Number.isNaN(eventDate.getTime())
        ? "시각 정보 없음"
        : seoulTimeFormatter.format(eventDate),
    );
    timestamp.dateTime = String(event.at);
    timestamp.dataset.label = "시각";

    const rawStage = String(event.stage ?? "");
    const stage = element(
      "span",
      "event-stage",
      stageLabels[rawStage] ?? "기타 제어",
    );
    stage.dataset.label = "통제 단계";

    const safeStatus = allowedStatuses.has(event.status)
      ? String(event.status)
      : "error";
    const status = element(
      "span",
      `event-status ${safeStatus}`,
      statusLabels[safeStatus],
    );
    status.dataset.label = "결정";

    const rawAction = String(event.action ?? "");
    const action = element("span", "event-action", formatAction(rawAction));
    action.dataset.label = "조치";
    action.title = rawAction;

    row.append(status, action, timestamp, stage);
    row.setAttribute(
      "aria-label",
      `${timestamp.textContent}, ${stage.textContent}, ${status.textContent}, ${action.textContent}`,
    );
    eventList.append(row);
  }
}

function setRefreshState(loading) {
  refresh.disabled = loading;
  refreshLabel.textContent = loading ? "불러오는 중" : "새로고침";
  eventList.setAttribute("aria-busy", String(loading));
}

async function loadEvents(announce = false) {
  if (eventsRequestInFlight || workspace.hidden) return;
  eventsRequestInFlight = true;
  setRefreshState(true);
  if (announce && refreshAnnouncement) refreshAnnouncement.textContent = "";
  if (eventList.querySelector(".state")) {
    renderState("loading", "보안 결정을 불러오는 중…");
  }

  try {
    const response = await fetch("/api/demo/events?limit=20", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("events unavailable");
    const payload = await response.json();
    renderEvents(payload.events);
    const currentEvents = eventsForActiveRequest(payload.events);
    if (activeRequestId) {
      if (currentEvents.length > 0) {
        updatePathFromEvents(currentEvents);
        renderCurrentAccessStatus(currentEvents, false, payload.events);
      }
    } else {
      resetTelemetryPath();
      renderCurrentAccessStatus([], false, payload.events);
    }
    lastUpdated.textContent = `마지막 업데이트 ${seoulTimeFormatter.format(new Date())}`;
    if (announce && refreshAnnouncement) {
      refreshAnnouncement.textContent = `보안 결정 ${String(payload.events.length)}건을 새로고침했습니다.`;
    }
  } catch {
    resetTelemetryPath();
    renderState(
      "error",
      "보안 결정 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    renderCurrentAccessStatus([], true);
    lastUpdated.textContent = "업데이트 실패";
    if (announce && refreshAnnouncement) {
      refreshAnnouncement.textContent =
        "보안 결정을 새로고침하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    }
  } finally {
    eventsRequestInFlight = false;
    setRefreshState(false);
  }
}

themeToggle?.addEventListener("click", toggleTheme);
refresh?.addEventListener("click", () => void loadEvents(true));
demoReset?.addEventListener("click", () => void resetDemoSession());

async function resetDemoSession() {
  demoReset.disabled = true;
  try {
    const response = await fetch("/api/demo/reset-session", {
      method: "POST",
      headers: { "x-csrf-token": csrfToken },
    });
    if (await redirectIfSessionExpired(response)) {
      return;
    }
    if (!response.ok) throw new Error("reset unavailable");
    latestCredential = null;
    latestTool = "";
    stopRequestProgressPolling();
    activeRequestId = null;
    conversation.innerHTML = defaultConversationMarkup;
    renderSuggestions();
    renderTrace([]);
    renderEvents([]);
    renderCurrentAccessStatus([]);
    resetTelemetryPath();
    lastUpdated.textContent = "데모 세션이 초기화되었습니다";
    input.value = "";
    input.focus();
    void runPreflight();
  } catch {
    addMessage(
      "agent",
      "현재 데모 세션을 초기화하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      "초기화 실패",
    );
  } finally {
    demoReset.disabled = false;
  }
}

document.querySelector("#identity-path")?.addEventListener("click", (event) => {
  const step = event.target.closest?.("[data-stage]");
  if (!step) return;
  openStageDialog(step.dataset.stage, step);
});

document
  .querySelector("#identity-path")
  ?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const step = event.target.closest?.("[data-stage]");
    if (!step) return;
    event.preventDefault();
    openStageDialog(step.dataset.stage, step);
  });

document.querySelectorAll("[data-stage-dialog-close]").forEach((button) => {
  button.addEventListener("click", closeStageDialog);
});

stageDialog?.addEventListener("click", (event) => {
  if (event.target === stageDialog) closeStageDialog();
});

stageDialog?.addEventListener("close", () => {
  if (stageDialogTrigger?.isConnected) stageDialogTrigger.focus();
  stageDialogTrigger = null;
});

stageDialogOpenAction?.addEventListener("click", () => {
  if (stageDialogOpenAction.dataset.action !== "focus-agent") return;
  closeStageDialog();
  window.requestAnimationFrame(() => {
    scrollChatToBottom();
    input?.focus({ preventScroll: true });
  });
});

stageDialogSecondaryAction?.addEventListener("click", async () => {
  const copyText = stageDialogSecondaryAction.dataset.copyText;
  if (!copyText) return;
  const originalLabel = stageDialogSecondaryAction.textContent;
  try {
    await window.navigator.clipboard.writeText(copyText);
    stageDialogSecondaryAction.textContent = "명령 복사됨";
  } catch {
    stageDialogSecondaryAction.textContent = "복사 불가";
  }
  window.setTimeout(() => {
    stageDialogSecondaryAction.textContent = originalLabel;
  }, 1400);
});

stageCodeCopy?.addEventListener("click", async () => {
  try {
    await window.navigator.clipboard.writeText(stageDialogCode.textContent);
    stageCodeCopy.textContent = "복사됨";
    window.setTimeout(() => (stageCodeCopy.textContent = "코드 복사"), 1200);
  } catch {
    stageCodeCopy.textContent = "복사 불가";
  }
});

stageCodeViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    renderStageCodeView(button.dataset.stageCodeView);
  });
});

function setUnauthenticatedStage(stage, label, status = "neutral") {
  const item = document.querySelector(`[data-unauth-stage="${stage}"]`);
  if (!item) return;
  item.className = status;
  const state = item.querySelector("span");
  if (state) state.textContent = label;
}

function resetUnauthenticatedDemo() {
  setUnauthenticatedStage("verify", "로그인 대기");
  setUnauthenticatedStage("agent", "권한 대기");
  setUnauthenticatedStage("mcp", "미실행");
  setUnauthenticatedStage("vault", "미실행");
  setUnauthenticatedStage("database", "미실행");
  if (unauthResult) {
    unauthResult.textContent = "테스트 전";
    unauthResult.className = "unauth-demo-result waiting";
  }
  if (unauthOutcome) {
    unauthOutcome.textContent =
      "데모 사용자는 인증되지만 Lab 접근 권한은 부여되지 않습니다.";
    unauthOutcome.className = "unauth-outcome";
  }
  if (unauthTest) {
    unauthTest.disabled = false;
    unauthTest.textContent = "미승인 사용자로 로그인";
  }
}

function resetVerifyDemoDialog() {
  verifyDemoForm.hidden = false;
  verifyDemoResultPanel.hidden = true;
  verifyDemoUsername.value = "";
  verifyDemoPassword.value = "";
  verifyDemoPassword.type = "password";
  verifyDemoPasswordToggle.setAttribute("aria-label", "비밀번호 표시");
  verifyDemoError.hidden = true;
  verifyDemoSubmit.disabled = false;
  verifyDemoSubmit.textContent = "사인인";
}

function openVerifyDemo() {
  if (!verifyDemoDialog || verifyDemoDialog.open) return;
  resetVerifyDemoDialog();
  verifyDemoDialog.showModal();
  window.setTimeout(() => verifyDemoUsername.focus(), 80);
}

function closeVerifyDemo() {
  if (!verifyDemoDialog?.open) return;
  verifyDemoDialog.close();
  unauthTest?.focus();
}

function applyUnapprovedUserResult() {
  setUnauthenticatedStage("verify", "인증 성공", "complete");
  setUnauthenticatedStage("agent", "권한 차단", "denied");
  setUnauthenticatedStage("mcp", "미실행");
  setUnauthenticatedStage("vault", "미실행");
  setUnauthenticatedStage("database", "미실행");
  unauthResult.textContent = "403 권한 차단";
  unauthResult.className = "unauth-demo-result denied";
  unauthOutcome.textContent =
    "Verify 사용자 인증과 JWT 발급은 성공했습니다. access_tier 권한 클레임이 없어 애플리케이션에서 차단했으며 Agent·MCP·Vault·DB는 실행하지 않았습니다.";
  unauthOutcome.className = "unauth-outcome denied";
  unauthTest.textContent = "미승인 사용자 다시 로그인";
}

unauthTest?.addEventListener("click", openVerifyDemo);
verifyDemoClose?.addEventListener("click", closeVerifyDemo);
verifyDemoDialog?.addEventListener("click", (event) => {
  if (event.target === verifyDemoDialog) closeVerifyDemo();
});
verifyDemoFill?.addEventListener("click", () => {
  verifyDemoUsername.value = "unapproved.user@demo.local";
  verifyDemoPassword.value = "DemoOnly!2026";
  verifyDemoError.hidden = true;
  verifyDemoUsername.focus();
});
verifyDemoPasswordToggle?.addEventListener("click", () => {
  const reveal = verifyDemoPassword.type === "password";
  verifyDemoPassword.type = reveal ? "text" : "password";
  verifyDemoPasswordToggle.setAttribute(
    "aria-label",
    reveal ? "비밀번호 숨기기" : "비밀번호 표시",
  );
});
verifyDemoForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const valid =
    verifyDemoUsername.value === "unapproved.user@demo.local" &&
    verifyDemoPassword.value === "DemoOnly!2026";
  if (!valid) {
    verifyDemoError.hidden = false;
    verifyDemoUsername.focus();
    return;
  }
  verifyDemoError.hidden = true;
  verifyDemoSubmit.disabled = true;
  verifyDemoSubmit.textContent = "신원 확인 중…";
  await new Promise((resolve) => window.setTimeout(resolve, 650));
  verifyDemoForm.hidden = true;
  verifyDemoResultPanel.hidden = false;
  verifyDemoFinish.focus();
});
verifyDemoFinish?.addEventListener("click", () => {
  applyUnapprovedUserResult();
  closeVerifyDemo();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void sendMessage(input.value);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

function resizeComposerInput() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
}

function populateComposer(message) {
  const prompt = String(message ?? "").trim();
  if (!prompt || input.disabled) return;
  input.value = prompt;
  resizeComposerInput();
  input.focus({ preventScroll: true });
  input.setSelectionRange(prompt.length, prompt.length);
  scrollChatToBottom();
}

input.addEventListener("input", resizeComposerInput);

shuffleSuggestionsButton?.addEventListener("click", () => {
  if (shuffleSuggestionsButton.disabled) return;
  renderSuggestions();
  shuffleSuggestionsButton.classList.remove("is-shuffling");
  window.requestAnimationFrame(() => {
    shuffleSuggestionsButton.classList.add("is-shuffling");
  });
});

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("button[data-prompt]");
  if (!button || button.disabled) return;
  const prompt = button.getAttribute("data-prompt");
  if (prompt && button.closest(".suggestions")) {
    populateComposer(prompt);
    return;
  }
  if (prompt) void sendMessage(prompt);
});

logout.addEventListener("click", async () => {
  logout.disabled = true;
  try {
    await fetch("/api/logout", {
      method: "POST",
      headers: { "x-csrf-token": csrfToken },
    });
  } finally {
    window.location.assign("/");
  }
});

applyTheme(preferredTheme());
renderSuggestions();
await loadStatus();

try {
  await loadSession();
} catch {
  showLogin();
  loginError.textContent =
    "인증 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  loginError.hidden = false;
}
