import { createServer, type Server } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { ContextForgeClient } from "../src/contextforge-client.js";

let server: Server | undefined;

afterEach(
  () =>
    new Promise<void>((resolve) => {
      if (!server) {
        resolve();
        return;
      }
      server.close(() => resolve());
      server = undefined;
    }),
);

describe("ContextForgeClient", () => {
  it("uses a server-scoped API token for MCP runtime calls", async () => {
    const serverId = "c0ffee00cafe40008000000000000001";
    const adminToken = "eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.";
    const runtimeToken = "contextforge-runtime-token-for-test-only";
    let runtimeTokenRequest: Record<string, unknown> | undefined;
    let runtimeTokenAuthorization: string | undefined;
    let runtimeProbeAuthorization: string | undefined;

    server = createServer((request, response) => {
      response.setHeader("content-type", "application/json");
      if (request.url === "/health" && request.method === "GET") {
        response.end(JSON.stringify({ status: "healthy" }));
        return;
      }
      if (request.url === "/auth/login" && request.method === "POST") {
        response.end(
          JSON.stringify({ access_token: adminToken, expires_in: 3_600 }),
        );
        return;
      }
      if (
        request.url === "/servers?include_pagination=false" &&
        request.method === "GET"
      ) {
        response.end(
          JSON.stringify([{ id: serverId, name: "bob-vault-security-lab" }]),
        );
        return;
      }
      if (request.url === "/tokens" && request.method === "POST") {
        runtimeTokenAuthorization = request.headers.authorization;
        let body = "";
        request.setEncoding("utf8");
        request.on("data", (chunk: string) => {
          body += chunk;
        });
        request.on("end", () => {
          runtimeTokenRequest = JSON.parse(body) as Record<string, unknown>;
          response.end(
            JSON.stringify({
              access_token: runtimeToken,
              token: { expires_at: "2099-01-01T00:00:00Z" },
            }),
          );
        });
        return;
      }
      if (
        request.url === `/servers/${serverId}/mcp` &&
        request.method === "POST"
      ) {
        runtimeProbeAuthorization = request.headers.authorization;
        request.resume();
        request.on("end", () => {
          response.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: "runtime-access-probe",
              result: { protocolVersion: "2025-06-18" },
            }),
          );
        });
        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ detail: "not found" }));
    });
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("test server did not bind");
    }

    const client = new ContextForgeClient({
      baseUrl: `http://127.0.0.1:${String(address.port)}`,
      serverId,
      adminEmail: "contextforge-admin@example.test",
      adminPassword: "not-a-real-password",
      upstreamUrl: "http://127.0.0.1:8080/mcp",
      upstreamDiscoveryToken: "discovery-token-for-test-only",
    });

    await expect(client.getAccessToken()).resolves.toBe(runtimeToken);
    expect(client.isReady()).toBe(true);
    expect(runtimeTokenAuthorization).toBe(`Bearer ${adminToken}`);
    expect(runtimeProbeAuthorization).toBe(`Bearer ${runtimeToken}`);
    expect(runtimeTokenRequest).toMatchObject({
      expires_in_days: 1,
      scope: {
        server_id: serverId,
        permissions: ["servers.use", "tools.read", "tools.execute"],
        ip_restrictions: ["127.0.0.1/32"],
      },
    });
  });
});
