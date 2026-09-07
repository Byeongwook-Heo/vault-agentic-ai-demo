import { Agent, request } from "undici";
import { z } from "zod";

import type { AccessTier } from "./access-control.js";
import type { AppConfig } from "./config.js";
import { AuthorizationError, ExternalServiceError } from "./errors.js";
import type { DynamicDatabaseCredentials, VaultSession } from "./types.js";

const loginResponseSchema = z
  .object({
    auth: z.object({
      client_token: z.string().min(1),
      lease_duration: z.number().int().nonnegative(),
      renewable: z.boolean(),
    }),
  })
  .loose();

const credentialsResponseSchema = z
  .object({
    lease_id: z.string().min(1),
    lease_duration: z.number().int().positive(),
    data: z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }),
  })
  .loose();

export interface VaultCredentialBroker {
  withDatabaseCredentials<T>(
    verifiedJwt: string,
    accessTier: AccessTier,
    operation: (credentials: DynamicDatabaseCredentials) => Promise<T>,
  ): Promise<T>;
  attemptDeniedDatabaseCredentials(
    verifiedJwt: string,
    accessTier: AccessTier,
    path: string,
  ): Promise<never>;
  close(): Promise<void>;
}

export class VaultClient implements VaultCredentialBroker {
  readonly #config: AppConfig["vault"];
  readonly #dispatcher: Agent;

  public constructor(config: AppConfig["vault"]) {
    this.#config = config;
    this.#dispatcher = new Agent({
      connect: {
        ca: config.caPem,
        rejectUnauthorized: true,
      },
    });
  }

  public async withDatabaseCredentials<T>(
    verifiedJwt: string,
    accessTier: AccessTier,
    operation: (credentials: DynamicDatabaseCredentials) => Promise<T>,
  ): Promise<T> {
    const profile = this.#profile(accessTier);
    const session = await this.#login(verifiedJwt, profile.jwtRole);
    let credentials: DynamicDatabaseCredentials | undefined;
    try {
      credentials = await this.#readDatabaseCredentials(
        session.clientToken,
        profile.databaseCredentialsPath,
        accessTier,
      );
      return await operation(credentials);
    } finally {
      if (credentials) {
        await this.#bestEffortRevokeLease(
          session.clientToken,
          credentials.leaseId,
        );
      }
      await this.#bestEffortRevokeToken(session);
    }
  }

  public async close(): Promise<void> {
    await this.#dispatcher.close();
  }

  public async attemptDeniedDatabaseCredentials(
    verifiedJwt: string,
    accessTier: AccessTier,
    path: string,
  ): Promise<never> {
    const session = await this.#login(
      verifiedJwt,
      this.#profile(accessTier).jwtRole,
    );
    try {
      const unexpected = credentialsResponseSchema.parse(
        await this.#requestJson("GET", `/v1/${path}`, session.clientToken),
      );
      await this.#bestEffortRevokeLease(
        session.clientToken,
        unexpected.lease_id,
      );
      throw new ExternalServiceError(
        "Vault",
        "the sensitive database role was unexpectedly authorized",
      );
    } finally {
      await this.#bestEffortRevokeToken(session);
    }
  }

  async #login(verifiedJwt: string, jwtRole: string): Promise<VaultSession> {
    const response = loginResponseSchema.parse(
      await this.#requestJson(
        "POST",
        `/v1/auth/${this.#config.jwtAuthPath}/login`,
        undefined,
        JSON.stringify({ jwt: verifiedJwt, role: jwtRole }),
      ),
    );
    return {
      clientToken: response.auth.client_token,
      renewable: response.auth.renewable,
      leaseDurationSeconds: response.auth.lease_duration,
    };
  }

  async #readDatabaseCredentials(
    clientToken: string,
    path: string,
    accessTier: AccessTier,
  ): Promise<DynamicDatabaseCredentials> {
    const response = credentialsResponseSchema.parse(
      await this.#requestJson("GET", `/v1/${path}`, clientToken),
    );
    return {
      username: response.data.username,
      password: response.data.password,
      leaseId: response.lease_id,
      leaseDurationSeconds: response.lease_duration,
      accessTier,
    };
  }

  async #bestEffortRevokeLease(
    clientToken: string,
    leaseId: string,
  ): Promise<void> {
    try {
      await this.#requestJson(
        "POST",
        "/v1/sys/leases/revoke",
        clientToken,
        JSON.stringify({ lease_id: leaseId }),
      );
    } catch {
      // Short TTL remains the safety boundary if explicit revocation is temporarily unavailable.
    }
  }

  async #bestEffortRevokeToken(session: VaultSession): Promise<void> {
    try {
      await this.#requestJson(
        "POST",
        "/v1/auth/token/revoke-self",
        session.clientToken,
        "{}",
      );
    } catch {
      // The Vault role enforces a short, non-renewable token TTL.
    }
  }

  async #requestJson(
    method: "GET" | "POST",
    path: string,
    clientToken?: string,
    body?: string,
  ): Promise<unknown> {
    const address = this.#required("address");
    const headers: Record<string, string> = {
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
      ...(clientToken ? { "x-vault-token": clientToken } : {}),
      ...(this.#config.namespace
        ? { "x-vault-namespace": this.#config.namespace }
        : {}),
    };

    let response;
    try {
      response = await request(`${address}${path}`, {
        method,
        headers,
        ...(body ? { body } : {}),
        dispatcher: this.#dispatcher,
        bodyTimeout: this.#config.requestTimeoutMs,
        headersTimeout: this.#config.requestTimeoutMs,
      });
    } catch (error) {
      throw new ExternalServiceError("Vault", "request failed", {
        cause: error,
      });
    }

    const responseBody = await response.body.text();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (response.statusCode === 403) {
        throw new AuthorizationError(
          "Vault policy denied the requested database role",
        );
      }
      throw new ExternalServiceError(
        "Vault",
        `request was rejected (${String(response.statusCode)})`,
      );
    }
    if (!responseBody) {
      return {};
    }

    try {
      return JSON.parse(responseBody);
    } catch (error) {
      throw new ExternalServiceError("Vault", "response was not valid JSON", {
        cause: error,
      });
    }
  }

  #required(field: "address" | "jwtRole"): string {
    const value = this.#config[field];
    if (!value) {
      throw new ExternalServiceError("Vault", `${field} is not configured`);
    }
    return value;
  }

  #profile(accessTier: AccessTier): {
    jwtRole: string;
    databaseCredentialsPath: string;
  } {
    if (accessTier === "orders-limited") {
      return {
        jwtRole: this.#config.limitedJwtRole,
        databaseCredentialsPath: this.#config.limitedDatabaseCredentialsPath,
      };
    }
    return {
      jwtRole: this.#required("jwtRole"),
      databaseCredentialsPath: this.#config.databaseCredentialsPath,
    };
  }
}
