import { readFile } from "node:fs/promises";

import pino from "pino";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import type { ChatAgent } from "../src/agent.js";
import { loadConfig } from "../src/config.js";
import type { OrdersDatabase } from "../src/database.js";
import { SecurityEventStore } from "../src/event-store.js";
import { createHttpApp } from "../src/http-app.js";
import type {
  IdentityProvider,
  OboTokenVerifier,
} from "../src/identity-client.js";
import { ToolService } from "../src/tool-service.js";
import type { UserAuthenticator, UserSession } from "../src/user-auth.js";
import type { VaultCredentialBroker } from "../src/vault-client.js";

const bearerToken = "transport-token-".padEnd(48, "x");

const authenticatedSession: UserSession = {
  subject: "user-123",
  displayName: "Demo User",
  email: "demo@example.test",
  accessToken: "header.payload.signature.user",
  csrfToken: "csrf-token-for-tests-123456789",
  expiresAt: 1_800_000_000,
};

function buildApp(options?: {
  session?: UserSession | null;
  mcpAuthMode?: "static_bearer" | "user_jwt" | "obo_jwt";
}) {
  const config = loadConfig({
    NODE_ENV: "test",
    APP_MODE: "bootstrap",
    LOG_LEVEL: "silent",
    TRANSPORT_BEARER_TOKEN: bearerToken,
    ALLOWED_ORIGINS: "https://bob.example.test",
    MCP_AUTH_MODE: options?.mcpAuthMode ?? "static_bearer",
  });
  const identity: IdentityProvider = {
    getVerifiedAccessToken: vi
      .fn()
      .mockResolvedValue("header.payload.signature"),
  };
  const vault: VaultCredentialBroker = {
    withDatabaseCredentials: vi.fn(async (_token, accessTier, operation) =>
      operation({
        username: "dynamic",
        password: "discarded",
        leaseId: "lease-id",
        leaseDurationSeconds: 120,
        accessTier,
      }),
    ),
    attemptDeniedDatabaseCredentials: vi.fn(),
    close: vi.fn(),
  };
  const database: OrdersDatabase = {
    getOrderStatus: vi.fn().mockResolvedValue({
      status: "found",
      order_id: "ORD-1001",
      payment_status: "PAID",
      delivery_status: "PREPARING",
      updated_at: "2026-07-30T00:00:00.000Z",
    }),
    getFailedPaymentSummary: vi.fn().mockResolvedValue({
      date: "2026-07-30",
      failed_count: 0,
      by_delivery_status: [],
    }),
    getRecentOrders: vi.fn().mockResolvedValue({ orders: [] }),
    getFailedPaymentTrend: vi.fn().mockResolvedValue({ days: 7, points: [] }),
  };
  const events = new SecurityEventStore();
  const tools = new ToolService(identity, vault, database, events);
  const userAuth: UserAuthenticator = {
    beginLogin: vi.fn().mockResolvedValue({
      redirectUrl: "https://verify.example.test/authorize",
      setCookie: "__Host-verify-login=transaction",
    }),
    completeLogin: vi.fn().mockResolvedValue({
      redirectUrl: "/",
      setCookies: ["__Host-chat-session=session"],
    }),
    readSession: vi.fn().mockResolvedValue(options?.session ?? null),
    verifyAccessToken: vi.fn().mockResolvedValue({
      subject: authenticatedSession.subject,
      displayName: authenticatedSession.displayName,
      accessToken: authenticatedSession.accessToken,
    }),
    clearSessionCookies: vi
      .fn()
      .mockReturnValue(["__Host-chat-session=; Max-Age=0"]),
  };
  const agent: ChatAgent = {
    respond: vi.fn().mockResolvedValue({
      reply: "주문 ORD-1001는 배송 준비 중입니다.",
      tool: "get_order_status",
      trace: [
        {
          label: "사용자 JWT",
          detail: "검증 완료",
          status: "verified",
        },
      ],
    }),
    preflight: vi.fn().mockResolvedValue({
      configured: true,
      ready: true,
      mode: "enhanced",
      fallbackReady: true,
    }),
    getStatus: vi.fn().mockReturnValue({
      configured: true,
      ready: true,
      mode: "enhanced",
      fallbackReady: true,
    }),
    reset: vi.fn(),
  };
  const oboVerifier: OboTokenVerifier = {
    verifyAccessToken: vi.fn().mockResolvedValue({
      subject: authenticatedSession.subject,
      displayName: authenticatedSession.displayName,
      accessToken: "header.payload.signature.obo",
    }),
  };
  return {
    app: createHttpApp({
      config,
      events,
      tools,
      userAuth,
      agent,
      oboVerifier,
      logger: pino({ level: "silent" }),
    }),
    events,
    vault,
    userAuth,
    oboVerifier,
    agent,
  };
}

const toolsListRequest = {
  jsonrpc: "2.0",
  id: "test-1",
  method: "tools/list",
  params: {},
};

describe("HTTP security boundary", () => {
  it("serves the unified chatbot and NHI control center", async () => {
    const { app } = buildApp();

    const response = await request(app).get("/");
    const html =
      response.status === 200
        ? response.text
        : await readFile(
            new URL("../public/index.html", import.meta.url),
            "utf8",
          );
    const appScript = await readFile(
      new URL("../public/app.js", import.meta.url),
      "utf8",
    );

    expect(html).toContain('id="chat-section"');
    expect(html).toContain('class="chat-composer"');
    expect(html).toMatch(/<\/div>\s*<div class="chat-composer">\s*<form/);
    expect(html).toContain('rel="icon"');
    expect(html).toContain('id="control-center"');
    expect(html).toContain('id="current-access-status"');
    expect(html).toContain('id="stage-dialog"');
    expect(html).toContain('id="stage-dialog-open-link"');
    expect(html).toContain("centered-glyph centered-glyph-close");
    expect(html).toContain('id="verify-demo-password-toggle"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('id="trace-stage-count"');
    expect(html).toContain('id="trace-progress-fill"');
    expect(html).toContain('id="access-mode-banner"');
    expect(html).toContain("미승인 사용자 모드");
    expect(html).toContain("일반 대화와 Lab 안내");
    expect(html).toContain('id="suggestions"');
    expect(html).toContain('id="shuffle-suggestions"');
    expect(html).not.toContain('id="request-progress-dock"');
    expect(appScript).toContain("protectedSuggestionPool");
    expect(appScript).toContain('button.dataset.protected = "true"');
    expect(html).toContain('data-stage="vault"');
    expect(html).toContain("/icons/custom/postgresql-elephant.svg");
    expect(html).toContain("/icons/custom/hashicorp-vault.svg");
    expect(html).toContain("Bob AI 에이전트");
    expect(html).toContain("접근제어");
    expect(html).not.toContain("composer-tabs");
    expect(html).not.toContain("side-rail");
    expect(html).not.toContain("보안 결정 추이");
    expect(html.toLowerCase()).not.toContain("ollama");
  });

  it("centers compact control glyphs and state markers", async () => {
    const styles = await readFile(
      new URL("../public/styles.css", import.meta.url),
      "utf8",
    );

    expect(styles).toContain(".centered-glyph");
    expect(styles).toContain(".dock-stage-marker::after");
    expect(styles).toContain(".path-node::after");
    expect(styles).toContain(".event-status::before");
    expect(styles).toContain(".access-status-indicator::before");
    expect(styles).toContain("place-items: center");
    expect(styles).toContain("grid-template-rows: 56px minmax(0, 1fr) auto");
  });

  it("serves a read-only MCP Inspector without credential inputs", async () => {
    const { app } = buildApp();

    const response = await request(app).get("/mcp-inspector.html");
    const html =
      response.status === 200
        ? response.text
        : await readFile(
            new URL("../public/mcp-inspector.html", import.meta.url),
            "utf8",
          );

    expect(html).toContain("MCP Server Inspector");
    expect(html).toContain("읽기 전용");
    expect(html).toContain("/api/status");
    expect(html).toContain("get_order_status");
    expect(html).toContain("get_sensitive_payment_data");
    expect(html).not.toContain("<form");
    expect(html).not.toContain('type="password"');
    expect(html.toLowerCase()).not.toContain("client_secret");
    expect(html.toLowerCase()).not.toContain("vault_token");
    expect(html.toLowerCase()).not.toContain("ollama");
  });

  it("ships restrained request-stage motion with reduced-motion support", async () => {
    const [script, styles] = await Promise.all([
      readFile(new URL("../public/app.js", import.meta.url), "utf8"),
      readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
    ]);

    expect(script).toContain("applyStageMotion");
    expect(script).toContain("resetVisiblePath(true)");
    expect(script).toContain("settleRequestFailure");
    expect(styles).toContain(".identity-path li.motion-active");
    expect(styles).toContain("marker-check-settle");
    expect(styles).toContain("connector-fill");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("redirects legacy operations routes to the unified control center", async () => {
    const { app } = buildApp();

    await request(app)
      .get("/ops")
      .expect(302)
      .expect("location", "/#control-center");
    await request(app)
      .get("/demo")
      .expect(302)
      .expect("location", "/#control-center");
  });

  it("returns health without exposing configuration", async () => {
    const { app } = buildApp();
    const response = await request(app).get("/healthz").expect(200);

    expect(response.body).toEqual({ status: "ok", version: "dev" });
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["content-security-policy"]).toContain(
      "default-src 'self'",
    );
  });

  it("rejects MCP requests without the bearer token", async () => {
    const { app, events, vault } = buildApp();

    await request(app)
      .post("/mcp")
      .set("accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: "unauthenticated-demo",
        method: "tools/call",
        params: { name: "get_recent_orders", arguments: { limit: 5 } },
      })
      .expect(401);

    expect(events.list()[0]).toMatchObject({
      stage: "transport",
      status: "denied",
    });
    expect(vault.withDatabaseCredentials).not.toHaveBeenCalled();
  });

  it("rejects unapproved browser origins", async () => {
    const { app } = buildApp();

    await request(app)
      .post("/mcp")
      .set("authorization", `Bearer ${bearerToken}`)
      .set("origin", "https://attacker.example")
      .set("accept", "application/json, text/event-stream")
      .send(toolsListRequest)
      .expect(401);
  });

  it("lists only the five fixed tools for an authenticated client", async () => {
    const { app } = buildApp();
    const response = await request(app)
      .post("/mcp")
      .set("authorization", `Bearer ${bearerToken}`)
      .set("origin", "https://bob.example.test")
      .set("accept", "application/json, text/event-stream")
      .send(toolsListRequest)
      .expect(200);

    expect(
      response.body.result.tools
        .map((tool: { name: string }) => tool.name)
        .sort(),
    ).toEqual([
      "get_failed_payment_summary",
      "get_failed_payment_trend",
      "get_order_status",
      "get_recent_orders",
      "get_sensitive_payment_data",
    ]);
  });

  it("preserves the Agent request ID forwarded through ContextForge", async () => {
    const { app, events } = buildApp();
    const requestId = "contextforge-request-123";

    await request(app)
      .post("/mcp")
      .set("authorization", `Bearer ${bearerToken}`)
      .set("origin", "https://bob.example.test")
      .set("x-upstream-request-id", requestId)
      .set("accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: "forwarded-request-id-test",
        method: "tools/call",
        params: {
          name: "get_order_status",
          arguments: { order_id: "ORD-1001" },
        },
      })
      .expect(200);

    expect(
      events
        .list()
        .filter((event) => event.action === "get_order_status")
        .map((event) => event.requestId),
    ).toEqual([requestId]);
  });

  it("preserves the Agent request ID in MCP metadata when the gateway replaces HTTP headers", async () => {
    const { app, events } = buildApp();
    const agentRequestId = "agent-request-through-meta-123";

    await request(app)
      .post("/mcp")
      .set("authorization", `Bearer ${bearerToken}`)
      .set("origin", "https://bob.example.test")
      .set("x-request-id", "contextforge-generated-request-456")
      .set("accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: "forwarded-request-meta-test",
        method: "tools/call",
        params: {
          name: "get_order_status",
          arguments: { order_id: "ORD-1001" },
          _meta: {
            "com.ibm.agentic-security-lab/request-id": agentRequestId,
          },
        },
      })
      .expect(200);

    expect(
      events
        .list()
        .filter((event) => event.action === "get_order_status")
        .map((event) => event.requestId),
    ).toEqual([agentRequestId]);
  });

  it("does not allow GET sessions for the stateless transport", async () => {
    const { app } = buildApp();

    await request(app)
      .get("/mcp")
      .set("authorization", `Bearer ${bearerToken}`)
      .expect(405)
      .expect("allow", "POST");
  });

  it("redirects a browser to the configured IBM Verify login", async () => {
    const { app } = buildApp();

    const response = await request(app).get("/auth/login").expect(302);

    expect(response.headers["location"]).toBe(
      "https://verify.example.test/authorize",
    );
    expect(response.headers["set-cookie"]?.[0]).toContain(
      "__Host-verify-login",
    );
  });

  it("returns only sanitized session information to the browser", async () => {
    const { app } = buildApp({ session: authenticatedSession });

    const response = await request(app).get("/api/me").expect(200);

    expect(response.body).toMatchObject({
      authenticated: true,
      authorization: "approved",
      user: {
        displayName: "Demo User",
        email: "demo@example.test",
      },
      csrfToken: authenticatedSession.csrfToken,
    });
    expect(JSON.stringify(response.body)).not.toContain(
      authenticatedSession.accessToken,
    );
  });

  it("returns an unapproved browser state without exposing credentials", async () => {
    const { app } = buildApp();

    const response = await request(app).get("/api/me").expect(200);

    expect(response.body).toEqual({
      authenticated: false,
      authorization: "unapproved",
      user: { displayName: "미승인 사용자" },
    });
    expect(response.body).not.toHaveProperty("csrfToken");
  });

  it("passes an unapproved chatbot request to the agent boundary", async () => {
    const { app, agent, vault } = buildApp();

    await request(app)
      .post("/api/chat")
      .send({ message: "주문 ORD-1001 상태" })
      .expect(200);

    expect(agent.respond).toHaveBeenCalledWith(
      "주문 ORD-1001 상태",
      {
        subject: "public-unapproved-user",
        displayName: "미승인 사용자",
        authorization: "unapproved",
      },
      expect.any(String),
    );
    expect(vault.withDatabaseCredentials).not.toHaveBeenCalled();
  });

  it("requires the session CSRF value for the chatbot", async () => {
    const { app } = buildApp({ session: authenticatedSession });

    await request(app)
      .post("/api/chat")
      .set("x-csrf-token", "incorrect-csrf")
      .send({ message: "주문 ORD-1001 상태" })
      .expect(401);
  });

  it("keeps an authenticated but unapproved user in the chatbot", async () => {
    const unapprovedSession: UserSession = {
      ...authenticatedSession,
      accessTier: "unapproved",
      accessTierClaimPresent: false,
      authorizationMode: "enforce",
    };
    const { app, agent } = buildApp({ session: unapprovedSession });

    const sessionResponse = await request(app).get("/api/me").expect(200);
    expect(sessionResponse.body).toMatchObject({
      authenticated: true,
      authorization: "unapproved",
      accessTier: "unapproved",
      authorizationMode: "enforce",
      csrfToken: unapprovedSession.csrfToken,
    });

    await request(app)
      .post("/api/chat")
      .set("x-csrf-token", unapprovedSession.csrfToken)
      .send({ message: "주문 ORD-1001 상태" })
      .expect(200);
    expect(agent.respond).toHaveBeenCalledWith(
      "주문 ORD-1001 상태",
      unapprovedSession,
      expect.any(String),
    );
  });

  it("passes an authenticated request to the bounded agent", async () => {
    const { app, agent, events } = buildApp({ session: authenticatedSession });
    const requestId = "demo-request-123";

    const response = await request(app)
      .post("/api/chat")
      .set("x-request-id", requestId)
      .set("x-csrf-token", authenticatedSession.csrfToken)
      .send({ message: "주문 ORD-1001 상태" })
      .expect(200);

    expect(response.body).toMatchObject({
      tool: "get_order_status",
      reply: expect.stringContaining("ORD-1001"),
      requestId,
    });
    expect(agent.respond).toHaveBeenCalledWith(
      "주문 ORD-1001 상태",
      authenticatedSession,
      requestId,
    );
    expect(events.list()[0]).toMatchObject({
      stage: "identity",
      status: "allowed",
      action: "user_session_authenticated",
      requestId,
    });
  });

  it("runs a user-scoped preflight and resets only the demo session", async () => {
    const { app, agent } = buildApp({ session: authenticatedSession });

    const preflight = await request(app)
      .post("/api/preflight")
      .set("x-csrf-token", authenticatedSession.csrfToken)
      .expect(200);
    await request(app)
      .post("/api/demo/reset-session")
      .set("x-csrf-token", authenticatedSession.csrfToken)
      .expect(204);

    expect(preflight.body).toMatchObject({ mode: "enhanced", ready: true });
    expect(agent.preflight).toHaveBeenCalledOnce();
    expect(agent.reset).toHaveBeenCalledWith(authenticatedSession.subject);
  });

  it("publishes only generic planning readiness in public status", async () => {
    const { app } = buildApp();

    const response = await request(app).get("/api/status").expect(200);
    const serialized = JSON.stringify(response.body).toLowerCase();

    expect(response.body.chatbot.planning).toMatchObject({
      mode: "enhanced",
      ready: true,
    });
    expect(response.body.controls.accessTiers).toEqual({
      mode: "enforce",
      claim: "access_tier",
      profiles: ["orders-full", "orders-limited", "unapproved"],
    });
    expect(serialized).not.toContain("ollama");
    expect(serialized).not.toContain("private-model");
  });

  it("accepts a verified user JWT as MCP transport identity", async () => {
    const { app, userAuth } = buildApp({ mcpAuthMode: "user_jwt" });

    await request(app)
      .post("/mcp")
      .set("authorization", `Bearer ${authenticatedSession.accessToken}`)
      .set("accept", "application/json, text/event-stream")
      .send(toolsListRequest)
      .expect(200);

    expect(userAuth.verifyAccessToken).toHaveBeenCalledWith(
      authenticatedSession.accessToken,
    );
  });

  it("accepts only a verified OBO JWT for tool execution", async () => {
    const { app, oboVerifier } = buildApp({ mcpAuthMode: "obo_jwt" });
    const oboToken = "header.payload.signature.obo";

    await request(app)
      .post("/mcp")
      .set("authorization", `Bearer ${oboToken}`)
      .set("accept", "application/json, text/event-stream")
      .send(toolsListRequest)
      .expect(200);

    expect(oboVerifier.verifyAccessToken).toHaveBeenCalledWith(oboToken);
  });

  it("limits the ContextForge discovery credential to catalog discovery", async () => {
    const { app } = buildApp({ mcpAuthMode: "obo_jwt" });

    await request(app)
      .post("/mcp")
      .set("authorization", `Bearer ${bearerToken}`)
      .set("accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: "test-call",
        method: "tools/call",
        params: { name: "get_recent_orders", arguments: { limit: 1 } },
      })
      .expect(401);
  });
});
