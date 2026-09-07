import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";
import { ConfigurationError } from "../src/errors.js";

const baseEnvironment = {
  NODE_ENV: "test",
  APP_MODE: "bootstrap",
  TRANSPORT_BEARER_TOKEN: "a".repeat(48),
};

describe("loadConfig", () => {
  it("loads a secure bootstrap configuration", () => {
    const config = loadConfig(baseEnvironment);

    expect(config.appMode).toBe("bootstrap");
    expect(config.port).toBe(8080);
    expect(config.vault.jwtAuthPath).toBe("jwt");
    expect(config.vault.jwtRole).toBe("bob-orders-full");
    expect(config.vault.databaseCredentialsPath).toBe(
      "database/creds/bob-orders-full",
    );
    expect(config.database.caFile).toBe("/app/certs/rds-ca.pem");
    expect(config.agentPlanning.mode).toBe("bounded");
    expect(config.accessControl).toEqual({
      mode: "enforce",
      claim: "access_tier",
      fullValue: "orders-full",
      limitedValue: "orders-limited",
    });
  });

  it("rejects short transport bearer secrets", () => {
    expect(() =>
      loadConfig({ ...baseEnvironment, TRANSPORT_BEARER_TOKEN: "short" }),
    ).toThrow(ConfigurationError);
  });

  it("requires every identity boundary in AWS mode", () => {
    expect(() => loadConfig({ ...baseEnvironment, APP_MODE: "aws" })).toThrow(
      /VERIFY_TOKEN_URL/,
    );
  });

  it("normalizes escaped certificate newlines", () => {
    const config = loadConfig({
      ...baseEnvironment,
      VAULT_CA_PEM: "first\\nsecond",
      DB_CA_PEM: "db-first\\ndb-second",
    });

    expect(config.vault.caPem).toBe("first\nsecond");
    expect(config.database.caPem).toBe("db-first\ndb-second");
  });

  it("requires OBO and user OIDC boundaries when the chatbot is enabled", () => {
    expect(() =>
      loadConfig({
        ...baseEnvironment,
        CHATBOT_ENABLED: "true",
      }),
    ).toThrow(/IDENTITY_FLOW must be obo/);
  });

  it("loads a complete Verify chatbot configuration", () => {
    const config = loadConfig({
      ...baseEnvironment,
      CHATBOT_ENABLED: "true",
      IDENTITY_FLOW: "obo",
      MCP_AUTH_MODE: "obo_jwt",
      CONTEXTFORGE_ENABLED: "true",
      CONTEXTFORGE_BASE_URL: "http://127.0.0.1:4444",
      CONTEXTFORGE_SERVER_ID: "c0ffee00cafe40008000000000000001",
      CONTEXTFORGE_ADMIN_EMAIL: "contextforge-admin@example.test",
      CONTEXTFORGE_ADMIN_PASSWORD: "p".repeat(32),
      CONTEXTFORGE_UPSTREAM_URL: "http://127.0.0.1:8080/mcp",
      SESSION_SECRET: "s".repeat(48),
      PUBLIC_BASE_URL: "https://chat.example.test",
      VERIFY_USER_AUTHORIZATION_URL: "https://verify.example.test/authorize",
      VERIFY_USER_TOKEN_URL: "https://verify.example.test/token",
      VERIFY_USER_JWKS_URL: "https://verify.example.test/jwks",
      VERIFY_USER_ISSUER: "https://verify.example.test/issuer",
      VERIFY_USER_CLIENT_ID: "chatbot-client",
      VERIFY_OBO_TOKEN_URL: "https://verify.example.test/oauth2/token",
      VERIFY_OBO_JWKS_URL: "https://verify.example.test/oauth2/jwks",
      VERIFY_OBO_ISSUER: "https://verify.example.test/oauth2",
      VERIFY_OBO_AUDIENCE: "vault-orders",
      VERIFY_OBO_CLIENT_ID: "agent-sts-client",
      VERIFY_OBO_ACTOR_VALUE: "agent-sts-client",
    });

    expect(config.chatbotEnabled).toBe(true);
    expect(config.mcpAuthMode).toBe("obo_jwt");
    expect(config.contextForge.enabled).toBe(true);
    expect(config.verify.obo.clientId).toBe("agent-sts-client");
    expect(config.accessControl.mode).toBe("enforce");
  });

  it("requires all private planning boundaries when enabled", () => {
    expect(() =>
      loadConfig({
        ...baseEnvironment,
        AGENT_PLANNING_MODE: "private",
      }),
    ).toThrow(/INFERENCE_BASE_URL/);
  });

  it("loads private planning configuration without exposing it elsewhere", () => {
    const config = loadConfig({
      ...baseEnvironment,
      AGENT_PLANNING_MODE: "private",
      INFERENCE_BASE_URL: "http://10.0.1.10:11434",
      INFERENCE_MODEL: "private-model",
      INFERENCE_API_TOKEN: "t".repeat(32),
    });

    expect(config.agentPlanning).toMatchObject({
      mode: "private",
      baseUrl: "http://10.0.1.10:11434",
      model: "private-model",
      timeoutMs: 30_000,
    });
  });
});
