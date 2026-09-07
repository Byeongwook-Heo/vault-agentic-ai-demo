const readiness = document.querySelector("#readiness");
const mode = document.querySelector("#mode");
const version = document.querySelector("#version");
const eventList = document.querySelector("#events");
const refresh = document.querySelector("#refresh");
const refreshLabel = refresh.querySelector(".refresh-label");
const lastUpdated = document.querySelector("#last-updated");
const decisionTotal = document.querySelector("#decision-total");
const decisionCaption = document.querySelector("#decision-caption");
const countAllowed = document.querySelector("#count-allowed");
const countDenied = document.querySelector("#count-denied");
const countError = document.querySelector("#count-error");
const segmentAllowed = document.querySelector("#segment-allowed");
const segmentDenied = document.querySelector("#segment-denied");
const segmentError = document.querySelector("#segment-error");
const stageChart = document.querySelector("#stage-chart");
const stageCaption = document.querySelector("#stage-caption");
const activityChart = document.querySelector("#activity-chart");
const activityCaption = document.querySelector("#activity-caption");

const allowedStatuses = new Set(["allowed", "denied", "error", "ok"]);

const statusLabels = {
  allowed: "허용",
  denied: "차단",
  error: "오류",
  ok: "정상",
};

const stageLabels = {
  transport: "MCP 전송",
  identity: "Verify 신원",
  vault: "Vault 정책",
  database: "PostgreSQL",
  policy: "에이전트 정책",
};

const actionLabels = {
  mcp_user_jwt_authenticated: "MCP 사용자 JWT 인증",
  mcp_request_authenticated: "MCP 요청 인증",
  invalid_bearer_token: "잘못된 Bearer 토큰 차단",
  invalid_user_jwt: "잘못된 사용자 JWT 차단",
  verify_obo_jwt_validated: "사용자·에이전트 OBO JWT 검증",
  verify_jwt_validated: "Verify JWT 검증",
  dynamic_credentials_issued: "동적 DB 자격증명 발급",
  get_order_status: "주문 상태 조회",
  get_failed_payment_summary: "실패 결제 요약 조회",
  vault_policy_denied: "Vault 정책 거부",
  vault_policy_allowed: "Vault 정책 허용",
  pii_access_denied: "민감 정보 접근 차단",
  "database/creds/bob-payment-pii": "민감 결제 DB 역할 요청 차단",
};

const seoulTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

let eventsRequestInFlight = false;

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setReadinessState(state) {
  readiness.classList.remove("ready", "error");
  if (state) readiness.classList.add(state);
}

function formatAction(action) {
  const rawAction = String(action ?? "");
  if (Object.hasOwn(actionLabels, rawAction)) return actionLabels[rawAction];
  const readableAction = rawAction.replaceAll("_", " ").replaceAll("/", " › ");
  return readableAction || "알 수 없는 조치";
}

function buildSummary(events) {
  const summary = {
    total: Array.isArray(events) ? events.length : 0,
    allowed: 0,
    denied: 0,
    error: 0,
    stageCounts: {
      transport: 0,
      identity: 0,
      vault: 0,
      database: 0,
      policy: 0,
    },
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

    const stage = String(event.stage ?? "");
    if (Object.hasOwn(summary.stageCounts, stage)) {
      summary.stageCounts[stage] += 1;
    }
  }

  return summary;
}

function setSegmentWidth(node, percent) {
  node.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function renderDecisionOverview(events) {
  const summary = buildSummary(events);
  decisionTotal.textContent = `${summary.total}건`;
  countAllowed.textContent = String(summary.allowed);
  countDenied.textContent = String(summary.denied);
  countError.textContent = String(summary.error);

  const denominator = summary.total || 1;
  setSegmentWidth(segmentAllowed, (summary.allowed / denominator) * 100);
  setSegmentWidth(segmentDenied, (summary.denied / denominator) * 100);
  setSegmentWidth(segmentError, (summary.error / denominator) * 100);

  if (!summary.total) {
    decisionCaption.textContent = "표시할 보안 결정이 아직 없습니다.";
    return;
  }

  decisionCaption.textContent =
    summary.denied > 0
      ? `최근 ${summary.total}건 중 ${summary.allowed}건은 정상 흐름, ${summary.denied}건은 정책 차단으로 끝났습니다.`
      : `최근 ${summary.total}건은 모두 정상 또는 허용 흐름으로 처리되었습니다.`;
}

function renderStageChart(events) {
  stageChart.replaceChildren();
  const summary = buildSummary(events);
  const entries = Object.entries(summary.stageCounts);
  const maxCount = Math.max(...entries.map(([, count]) => count), 0);

  if (!summary.total || maxCount === 0) {
    stageCaption.textContent = "단계별 분포를 계산할 이벤트가 없습니다.";
    stageChart.append(
      makeElement("p", "chart-caption", "표시할 단계별 데이터가 없습니다."),
    );
    return;
  }

  const [topStageKey, topStageCount] = [...entries].sort(
    (left, right) => right[1] - left[1],
  )[0];
  stageCaption.textContent = `${stageLabels[topStageKey] ?? topStageKey} 단계가 ${topStageCount}건으로 가장 많이 관측되었습니다.`;

  for (const [stageKey, count] of entries) {
    const row = document.createElement("div");
    row.className = "stage-row";

    const label = makeElement(
      "span",
      "stage-label",
      stageLabels[stageKey] ?? stageKey,
    );
    const track = makeElement("div", "stage-track");
    const fill = makeElement("span", "stage-fill");
    fill.style.width = `${(count / maxCount) * 100}%`;
    track.append(fill);
    const value = makeElement("span", "stage-value", String(count));
    row.append(label, track, value);
    row.setAttribute(
      "aria-label",
      `${label.textContent} 단계 ${String(count)}건`,
    );
    stageChart.append(row);
  }
}

function legendItem(labelText, className) {
  const label = document.createElement("span");
  const marker = document.createElement("i");
  marker.className = className;
  label.append(marker, document.createTextNode(labelText));
  return label;
}

function renderActivityChart(events) {
  activityChart.replaceChildren();

  if (!Array.isArray(events) || events.length === 0) {
    activityCaption.textContent = "최근 요청 흐름을 계산할 이벤트가 없습니다.";
    activityChart.append(
      makeElement("p", "chart-caption", "표시할 최근 이벤트가 없습니다."),
    );
    return;
  }

  const items = events.slice(0, 10).reverse();
  const strip = makeElement("div", "activity-strip");

  for (const event of items) {
    const safeStatus = allowedStatuses.has(event.status)
      ? String(event.status)
      : "error";
    const point = makeElement("article", `activity-point ${safeStatus}`);
    const marker = document.createElement("span");
    const eventTime = new Date(event.at);
    const stage = makeElement(
      "strong",
      "",
      stageLabels[String(event.stage ?? "")] ?? "기타 제어",
    );
    const time = makeElement(
      "small",
      "",
      Number.isNaN(eventTime.getTime())
        ? "시각 정보 없음"
        : seoulTimeFormatter.format(eventTime),
    );
    const status = makeElement(
      "small",
      "activity-status",
      statusLabels[safeStatus] ?? "오류",
    );
    point.title = formatAction(event.action);
    point.setAttribute(
      "aria-label",
      `${stage.textContent} ${time.textContent} ${statusLabels[safeStatus] ?? "오류"} ${formatAction(event.action)}`,
    );
    point.append(marker, stage, time, status);
    strip.append(point);
  }

  const latestEvent = events[0];
  activityCaption.textContent = `가장 최근 조치는 ${formatAction(latestEvent.action)}이며, 결과는 ${statusLabels[String(latestEvent.status)] ?? "오류"}입니다.`;

  const legend = makeElement("div", "activity-legend");
  legend.append(
    legendItem("정상·허용", "allowed"),
    legendItem("차단", "denied"),
    legendItem("오류", "error"),
  );

  activityChart.append(strip, legend);
}

async function loadStatus() {
  try {
    const response = await fetch("/api/status", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("status unavailable");
    const status = await response.json();
    readiness.textContent = status.configured
      ? "보안 제어 적용됨"
      : "초기 설정 필요";
    setReadinessState(status.configured ? "ready" : "");
    mode.textContent = status.configured
      ? "신원·권한 경로 구성 완료"
      : "IBM Verify 설정값 대기 중";
    const safeVersion = String(status.version ?? "알 수 없음").slice(0, 32);
    version.textContent = `버전 ${safeVersion}`;
  } catch {
    readiness.textContent = "상태 확인 불가";
    setReadinessState("error");
    mode.textContent = "서비스 상태 확인에 실패했습니다";
    version.textContent = "버전 정보를 불러올 수 없음";
  }
}

function renderState(kind, message) {
  eventList.replaceChildren(makeElement("li", `state ${kind}`, message));
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
    const timestamp = makeElement(
      "time",
      "",
      Number.isNaN(eventDate.getTime())
        ? "시각 정보 없음"
        : seoulTimeFormatter.format(eventDate),
    );
    timestamp.dateTime = String(event.at);
    timestamp.dataset.label = "시각";

    const rawStage = String(event.stage ?? "");
    const stage = makeElement(
      "span",
      "event-stage",
      stageLabels[rawStage] ?? "기타 제어",
    );
    stage.dataset.label = "통제 단계";

    const safeStatus = allowedStatuses.has(event.status)
      ? String(event.status)
      : "error";
    const status = makeElement(
      "span",
      `event-status ${safeStatus}`,
      statusLabels[safeStatus],
    );
    status.dataset.label = "결정";

    const rawAction = String(event.action ?? "");
    const action = makeElement("span", "event-action", formatAction(rawAction));
    action.dataset.label = "조치";
    action.title = rawAction;

    row.append(timestamp, stage, status, action);
    row.setAttribute(
      "aria-label",
      `${timestamp.textContent}, ${stage.textContent}, ${status.textContent}, ${action.textContent}`,
    );
    eventList.append(row);
  }
}

function setRefreshState(loading) {
  refresh.disabled = loading;
  refresh.classList.toggle("is-loading", loading);
  refreshLabel.textContent = loading ? "불러오는 중" : "새로고침";
  eventList.setAttribute("aria-busy", String(loading));
}

async function loadEvents() {
  if (eventsRequestInFlight) return;
  eventsRequestInFlight = true;
  setRefreshState(true);
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
    renderDecisionOverview(payload.events);
    renderStageChart(payload.events);
    renderActivityChart(payload.events);
    lastUpdated.textContent = `마지막 업데이트 ${seoulTimeFormatter.format(new Date())}`;
  } catch {
    renderState(
      "error",
      "보안 결정 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    renderDecisionOverview([]);
    renderStageChart([]);
    renderActivityChart([]);
    lastUpdated.textContent = "업데이트 실패";
  } finally {
    eventsRequestInFlight = false;
    setRefreshState(false);
  }
}

refresh.addEventListener("click", loadEvents);
await Promise.all([loadStatus(), loadEvents()]);
window.setInterval(loadEvents, 10_000);
