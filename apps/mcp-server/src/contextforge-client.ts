import { decodeJwt } from "jose";
import { request } from "undici";
import { z } from "zod";

import {
  AuthenticationError,
  ConfigurationError,
  ExternalServiceError,
} from "./errors.js";

const loginResponseSchema = z
  .object({
    access_token: z.string().min(20),
    expires_in: z.number().int().positive(),
  })
  .loose();
const runtimeTokenResponseSchema = z
  .object({
    access_token: z.string().min(20),
    token: z
      .object({
        expires_at: z.string().min(1).nullable(),
      })
      .loose(),
  })
  .loose();
const gatewaySchema = z
  .object({ id: z.string().min(1), name: z.string() })
  .loose();
const toolSchema = z
  .object({
    id: z.string().min(1),
    gateway_id: z.string().nullable().optional(),
    name: z.string().min(1),
    original_name: z.string().min(1).optional(),
  })
  .loose();
const serverSchema = z
  .object({ id: z.string().min(1), name: z.string() })
  .loose();

export interface GatewayTokenProvider {
  getAccessToken(): Promise<string>;
}

interface ContextForgeConfig {
  baseUrl: string;
  serverId: string;
  adminEmail: string;
  adminPassword: string;
  upstreamUrl: string;
  upstreamDiscoveryToken: string;
}

const expectedToolNames = new Set([
  "get_order_status",
  "get_failed_payment_summary",
  "get_recent_orders",
  "get_failed_payment_trend",
  "get_sensitive_payment_data",
]);

export class ContextForgeClient implements GatewayTokenProvider {
  readonly #config: ContextForgeConfig;
  #adminAccessToken?: string;
  #adminAccessTokenExpiresAt = 0;
  #runtimeAccessToken?: string;
  #runtimeAccessTokenExpiresAt = 0;
  #bootstrap: Promise<void> | undefined;
  #ready = false;

  public constructor(config: ContextForgeConfig) {
    this.#config = config;
  }

  public async initialize(): Promise<void> {
    if (!this.#bootstrap) {
      this.#bootstrap = this.#initialize().catch((error: unknown) => {
        this.#bootstrap = undefined;
        this.#ready = false;
        throw error;
      });
    }
    await this.#bootstrap;
  }

  public isReady(): boolean {
    return this.#ready;
  }

  public async getAccessToken(): Promise<string> {
    await this.initialize();
    if (
      !this.#runtimeAccessToken ||
      this.#runtimeAccessTokenExpiresAt <= Math.floor(Date.now() / 1000) + 30
    ) {
      await this.#provisionRuntimeToken();
    }
    if (!this.#runtimeAccessToken) {
      throw new AuthenticationError(
        "ContextForge runtime access token is unavailable",
      );
    }
    return this.#runtimeAccessToken;
  }

  async #initialize(): Promise<void> {
    await this.#waitForHealth();
    await this.#login();
    const token = this.#adminAccessToken;
    if (!token) {
      throw new AuthenticationError(
        "ContextForge login did not return a token",
      );
    }

    const servers = z
      .array(serverSchema)
      .parse(
        await this.#requestJson(
          "GET",
          "/servers?include_pagination=false",
          token,
        ),
      );
    const serverExists = servers.some(
      (server) => normalizeUuid(server.id) === this.#config.serverId,
    );
    if (!serverExists) {
      const gateways = z
        .array(gatewaySchema)
        .parse(
          await this.#requestJson(
            "GET",
            "/gateways?include_pagination=false",
            token,
          ),
        );
      let gateway = gateways.find(
        (candidate) => candidate.name === "bob-vault-mcp-upstream",
      );
      gateway ??= gatewaySchema.parse(
        await this.#requestJson("POST", "/gateways", token, {
          name: "bob-vault-mcp-upstream",
          description:
            "Private Bob MCP Server discovered with one-time bootstrap credentials",
          url: this.#config.upstreamUrl,
          transport: "STREAMABLEHTTP",
          passthrough_headers: [
            "X-Upstream-Authorization",
            "X-Upstream-Request-Id",
          ],
          auth_type: "bearer",
          auth_token: this.#config.upstreamDiscoveryToken,
          one_time_auth: true,
          visibility: "public",
        }),
      );

      const toolIds = await this.#waitForDiscoveredTools(token, gateway.id);

      const created = serverSchema.parse(
        await this.#requestJson("POST", "/servers", token, {
          server: {
            id: this.#config.serverId,
            name: "bob-vault-security-lab",
            description: "Policy-bound tools for the Agentic Security Lab",
            associated_tools: toolIds,
          },
          visibility: "public",
        }),
      );
      if (normalizeUuid(created.id) !== this.#config.serverId) {
        throw new ConfigurationError(
          "ContextForge created an unexpected virtual server identifier",
        );
      }
    }
    await this.#provisionRuntimeToken();
    this.#ready = true;
  }

  async #waitForDiscoveredTools(
    token: string,
    gatewayId: string,
  ): Promise<string[]> {
    let discoveredCount = 0;
    let gatewayMatchedCount = 0;
    let expectedNameMatchedCount = 0;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const tools = z
        .array(toolSchema)
        .parse(
          await this.#requestJson(
            "GET",
            "/tools?include_pagination=false",
            token,
          ),
        );
      discoveredCount = tools.length;
      const gatewayTools = tools.filter(
        (tool) =>
          tool.gateway_id !== null &&
          tool.gateway_id !== undefined &&
          normalizeUuid(tool.gateway_id) === normalizeUuid(gatewayId),
      );
      gatewayMatchedCount = gatewayTools.length;
      const expectedTools = tools.filter((tool) =>
        expectedToolNames.has(tool.original_name ?? tool.name),
      );
      expectedNameMatchedCount = expectedTools.length;
      // This sidecar uses an isolated, ephemeral registry and the private MCP
      // server is its only tool source. ContextForge may omit gateway_id and
      // namespace original_name in list responses, so an exact five-tool
      // registry is still unambiguous and fail-closed.
      const selectedTools =
        gatewayTools.length === expectedToolNames.size
          ? gatewayTools
          : expectedTools.length === expectedToolNames.size
            ? expectedTools
            : tools.length === expectedToolNames.size
              ? tools
              : [];
      const toolIds = selectedTools.map((tool) => tool.id);
      if (toolIds.length === expectedToolNames.size) return toolIds;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    throw new ConfigurationError(
      `ContextForge did not expose the five expected private MCP tools (discovered=${String(discoveredCount)}, gatewayMatched=${String(gatewayMatchedCount)}, nameMatched=${String(expectedNameMatchedCount)})`,
    );
  }

  async #waitForHealth(): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const response = await request(`${this.#config.baseUrl}/health`, {
          method: "GET",
          headersTimeout: 2_000,
          bodyTimeout: 2_000,
        });
        const body = await response.body.text();
        if (response.statusCode === 200) {
          const parsed = z
            .object({ status: z.literal("healthy") })
            .loose()
            .safeParse(JSON.parse(body));
          if (parsed.success) return;
        }
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    throw new ExternalServiceError(
      "ContextForge",
      "gateway health check did not become ready",
      { cause: lastError },
    );
  }

  async #login(): Promise<void> {
    const payload = loginResponseSchema.parse(
      await this.#requestJson("POST", "/auth/login", undefined, {
        email: this.#config.adminEmail,
        password: this.#config.adminPassword,
      }),
    );
    this.#adminAccessToken = payload.access_token;
    const decoded = decodeJwt(payload.access_token);
    this.#adminAccessTokenExpiresAt =
      decoded.exp ?? Math.floor(Date.now() / 1000) + payload.expires_in;
  }

  async #provisionRuntimeToken(): Promise<void> {
    if (
      !this.#adminAccessToken ||
      this.#adminAccessTokenExpiresAt <= Math.floor(Date.now() / 1000) + 30
    ) {
      await this.#login();
    }
    if (!this.#adminAccessToken) {
      throw new AuthenticationError(
        "ContextForge admin session is unavailable",
      );
    }
    const payload = runtimeTokenResponseSchema.parse(
      await this.#requestJson("POST", "/tokens", this.#adminAccessToken, {
        name: `bob-vault-mcp-runtime-${String(Date.now())}`,
        description:
          "Short-lived runtime token for the isolated Agentic Security Lab virtual server",
        expires_in_days: 1,
        scope: {
          server_id: this.#config.serverId,
          permissions: ["servers.use", "tools.read", "tools.execute"],
          ip_restrictions: ["127.0.0.1/32"],
        },
      }),
    );
    const expiresAt = payload.token.expires_at
      ? Math.floor(Date.parse(payload.token.expires_at) / 1_000)
      : 0;
    if (
      !Number.isFinite(expiresAt) ||
      expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      throw new ConfigurationError(
        "ContextForge runtime token did not include a valid future expiration",
      );
    }
    await this.#verifyRuntimeMcpAccess(payload.access_token);
    this.#runtimeAccessToken = payload.access_token;
    this.#runtimeAccessTokenExpiresAt = expiresAt;
  }

  async #verifyRuntimeMcpAccess(accessToken: string): Promise<void> {
    let response;
    try {
      response = await request(
        `${this.#config.baseUrl}/servers/${this.#config.serverId}/mcp`,
        {
          method: "POST",
          headers: {
            accept: "application/json, text/event-stream",
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "runtime-access-probe",
            method: "initialize",
            params: {
              protocolVersion: "2025-06-18",
              capabilities: {},
              clientInfo: {
                name: "bob-vault-runtime-probe",
                version: "0.1.0",
              },
            },
          }),
          headersTimeout: 8_000,
          bodyTimeout: 15_000,
        },
      );
    } catch (error) {
      throw new ExternalServiceError(
        "ContextForge",
        "runtime MCP access probe failed",
        { cause: error },
      );
    }
    await response.body.text();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new ExternalServiceError(
        "ContextForge",
        `runtime MCP access was rejected (${String(response.statusCode)})`,
      );
    }
  }

  async #requestJson(
    method: "GET" | "POST",
    path: string,
    accessToken?: string,
    body?: object,
  ): Promise<unknown> {
    let response;
    try {
      response = await request(`${this.#config.baseUrl}${path}`, {
        method,
        headers: {
          accept: "application/json",
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        headersTimeout: 8_000,
        bodyTimeout: 15_000,
      });
    } catch (error) {
      throw new ExternalServiceError("ContextForge", "request failed", {
        cause: error,
      });
    }
    const responseText = await response.body.text();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new ExternalServiceError(
        "ContextForge",
        `request was rejected (${String(response.statusCode)})`,
      );
    }
    try {
      return JSON.parse(responseText);
    } catch (error) {
      throw new ExternalServiceError(
        "ContextForge",
        "response was not valid JSON",
        { cause: error },
      );
    }
  }
}

function normalizeUuid(value: string): string {
  return value.replaceAll("-", "").toLowerCase();
}
