const root = document.documentElement;
const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
const themeToggle = document.querySelector("#inspector-theme-toggle");
const themeLabel = document.querySelector("#inspector-theme-label");
const themeSymbol = document.querySelector(".theme-symbol");
const health = document.querySelector("#inspector-health");
const healthLabel = document.querySelector("#inspector-health-label");

const fields = {
  mode: document.querySelector("#inspector-mode"),
  version: document.querySelector("#inspector-version"),
  protocol: document.querySelector("#inspector-protocol"),
  planning: document.querySelector("#inspector-planning"),
  transport: document.querySelector("#inspector-transport"),
  workload: document.querySelector("#inspector-workload"),
  authorization: document.querySelector("#inspector-authorization"),
  credentials: document.querySelector("#inspector-credentials"),
};

function applyTheme(theme) {
  root.dataset.theme = theme;
  const dark = theme === "dark";
  metaColorScheme?.setAttribute("content", dark ? "dark light" : "light dark");
  themeToggle?.setAttribute("aria-pressed", String(dark));
  if (themeLabel) themeLabel.textContent = dark ? "라이트 모드" : "다크 모드";
  if (themeSymbol) themeSymbol.textContent = dark ? "☾" : "☼";
}

function toggleTheme() {
  const theme = root.dataset.theme === "dark" ? "light" : "dark";
  try {
    window.localStorage.setItem("bob-vault-demo-theme", theme);
  } catch {
    // Theme persistence is optional.
  }
  applyTheme(theme);
}

function setText(field, value) {
  if (fields[field]) fields[field].textContent = value || "—";
}

async function loadInspector() {
  try {
    const [healthResponse, statusResponse] = await Promise.all([
      fetch("/healthz", { cache: "no-store" }),
      fetch("/api/status", { cache: "no-store" }),
    ]);
    if (!healthResponse.ok || !statusResponse.ok) {
      throw new Error("public status unavailable");
    }

    const [healthPayload, status] = await Promise.all([
      healthResponse.json(),
      statusResponse.json(),
    ]);
    health.classList.add("healthy");
    healthLabel.textContent =
      healthPayload.status === "ok" ? "정상 작동" : "상태 확인 필요";
    setText("mode", status.mode === "aws" ? "AWS" : status.mode);
    setText("version", status.version);
    setText("protocol", status.protocol);
    setText(
      "planning",
      status.chatbot?.planning?.ready ? "준비 완료" : "안전 모드",
    );
    setText("transport", status.controls?.transport);
    setText("workload", status.controls?.workloadIdentity);
    setText("authorization", status.controls?.authorization);
    setText("credentials", status.controls?.credentials);
  } catch {
    health.classList.add("unavailable");
    healthLabel.textContent = "상태를 불러오지 못함";
  }
}

applyTheme(root.dataset.theme === "dark" ? "dark" : "light");
themeToggle?.addEventListener("click", toggleTheme);
void loadInspector();
