import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  createRemoteJWKSet,
  EncryptJWT,
  jwtDecrypt,
  jwtVerify,
  type JWTPayload,
} from "jose";
import { request } from "undici";
import { z } from "zod";

import {
  type AccessTier,
  type AccessTierConfig,
  type AccessTierEnforcementMode,
  type EffectiveAccessTier,
  defaultAccessTierConfig,
  resolveAccessTier,
} from "./access-control.js";
import {
  AuthenticationError,
  ConfigurationError,
  ExternalServiceError,
} from "./errors.js";

const transactionCookie = "__Host-verify-login";
const sessionCookie = "__Host-chat-session";
const authorizationCodeResponseSchema = z
  .object({
    access_token: z.string().min(20),
    id_token: z.string().min(20),
    expires_in: z.number().int().positive().optional(),
    token_type: z.string().min(1),
  })
  .loose();

interface VerifyUserAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  jwksUrl: string;
  issuer: string;
  audience?: string;
  clientId: string;
  clientSecret?: string;
  scopes: string;
  redirectUri: string;
  sessionSecret: string;
  accessControl?: AccessTierConfig;
}

interface LoginTransaction extends JWTPayload {
  state: string;
  nonce: string;
  verifier: string;
}

export interface UserPrincipal {
  subject: string;
  displayName: string;
  email?: string;
  accessToken: string;
  accessTier?: EffectiveAccessTier;
  assertedAccessTier?: AccessTier;
  accessTierClaimPresent?: boolean;
  authorizationMode?: AccessTierEnforcementMode;
}

export interface UserSession extends UserPrincipal {
  csrfToken: string;
  expiresAt: number;
}

export interface UserAuthenticator {
  beginLogin(): Promise<{ redirectUrl: string; setCookie: string }>;
  completeLogin(
    query: Record<string, unknown>,
    cookieHeader: string | undefined,
  ): Promise<{ redirectUrl: string; setCookies: string[] }>;
  readSession(cookieHeader: string | undefined): Promise<UserSession | null>;
  verifyAccessToken(accessToken: string): Promise<UserPrincipal>;
  clearSessionCookies(): string[];
}

export class VerifyUserAuth implements UserAuthenticator {
  readonly #config: VerifyUserAuthConfig;
  readonly #key: Uint8Array;
  readonly #jwks: ReturnType<typeof createRemoteJWKSet>;
  readonly #accessControl: AccessTierConfig;

  public constructor(config: VerifyUserAuthConfig) {
    this.#config = config;
    this.#accessControl = config.accessControl ?? defaultAccessTierConfig;
    this.#key = createHash("sha256").update(config.sessionSecret).digest();
    this.#jwks = createRemoteJWKSet(new URL(config.jwksUrl), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
      timeoutDuration: 5_000,
    });
  }

  public async beginLogin(): Promise<{
    redirectUrl: string;
    setCookie: string;
  }> {
    const state = randomBytes(24).toString("base64url");
    const nonce = randomBytes(24).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const transaction = await new EncryptJWT({ state, nonce, verifier })
      .setProtectedHeader({ alg: "dir", enc: "A256GCM", typ: "JWT" })
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime("5m")
      .encrypt(this.#key);

    const redirect = new URL(this.#config.authorizationUrl);
    redirect.search = new URLSearchParams({
      response_type: "code",
      client_id: this.#config.clientId,
      redirect_uri: this.#config.redirectUri,
      scope: this.#config.scopes,
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      // The chatbot session and the Verify SSO session have independent
      // lifecycles. Force active authentication so a user who signed out of
      // the chatbot cannot silently reuse the previous Verify identity.
      prompt: "login",
      max_age: "0",
    }).toString();

    return {
      redirectUrl: redirect.toString(),
      setCookie: serializeCookie(transactionCookie, transaction, {
        maxAge: 300,
        path: "/",
      }),
    };
  }

  public async completeLogin(
    query: Record<string, unknown>,
    cookieHeader: string | undefined,
  ): Promise<{ redirectUrl: string; setCookies: string[] }> {
    if (typeof query["error"] === "string") {
      throw new AuthenticationError("IBM Verify login was not completed");
    }
    const code = singleQueryValue(query["code"]);
    const state = singleQueryValue(query["state"]);
    const encryptedTransaction = readCookie(cookieHeader, transactionCookie);
    if (!code || !state || !encryptedTransaction) {
      throw new AuthenticationError("The login callback is incomplete");
    }

    let transaction: LoginTransaction;
    try {
      const decrypted = await jwtDecrypt(encryptedTransaction, this.#key, {
        keyManagementAlgorithms: ["dir"],
        contentEncryptionAlgorithms: ["A256GCM"],
      });
      transaction = loginTransactionSchema.parse(decrypted.payload);
    } catch (error) {
      throw new AuthenticationError("The login transaction is invalid", {
        cause: error,
      });
    }
    if (!constantTimeEqual(state, transaction.state)) {
      throw new AuthenticationError("The login state did not match");
    }

    const tokens = await this.#exchangeAuthorizationCode(
      code,
      transaction.verifier,
    );
    const audience = this.#config.audience ?? this.#config.clientId;
    let idPayload: JWTPayload;
    let verifiedAccessToken: UserPrincipal;
    try {
      const verification = await jwtVerify(tokens.id_token, this.#jwks, {
        issuer: this.#config.issuer,
        audience,
        algorithms: ["RS256"],
      });
      idPayload = verification.payload;
      if (
        typeof idPayload["nonce"] !== "string" ||
        !constantTimeEqual(idPayload["nonce"], transaction.nonce)
      ) {
        throw new AuthenticationError("The ID token nonce did not match");
      }
      verifiedAccessToken = await this.verifyAccessToken(tokens.access_token);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError("IBM Verify token validation failed", {
        cause: error,
      });
    }

    const subject = requiredStringClaim(idPayload, "sub");
    const displayName =
      optionalStringClaim(idPayload, "name") ??
      optionalStringClaim(idPayload, "preferred_username") ??
      optionalStringClaim(idPayload, "email") ??
      subject;
    const email = optionalStringClaim(idPayload, "email");
    const now = Math.floor(Date.now() / 1000);
    const sessionExpiry = Math.min(
      now + (tokens.expires_in ?? 1800),
      idPayload.exp ?? now + 1800,
    );
    const encryptedSession = await new EncryptJWT({
      sub: subject,
      name: displayName,
      ...(email ? { email } : {}),
      access_token: tokens.access_token,
      access_tier: verifiedAccessToken.accessTier ?? "orders-full",
      ...(verifiedAccessToken.assertedAccessTier
        ? { asserted_access_tier: verifiedAccessToken.assertedAccessTier }
        : {}),
      access_tier_claim_present:
        verifiedAccessToken.accessTierClaimPresent ?? false,
      authorization_mode:
        verifiedAccessToken.authorizationMode ?? this.#accessControl.mode,
      csrf: randomBytes(24).toString("base64url"),
    })
      .setProtectedHeader({ alg: "dir", enc: "A256GCM", typ: "JWT" })
      .setIssuedAt(now)
      .setJti(randomUUID())
      .setExpirationTime(sessionExpiry)
      .encrypt(this.#key);

    return {
      redirectUrl: "/",
      setCookies: [
        serializeCookie(transactionCookie, "", {
          maxAge: 0,
          path: "/",
        }),
        serializeCookie(sessionCookie, encryptedSession, {
          maxAge: Math.max(1, sessionExpiry - now),
          path: "/",
        }),
      ],
    };
  }

  public async readSession(
    cookieHeader: string | undefined,
  ): Promise<UserSession | null> {
    const encryptedSession = readCookie(cookieHeader, sessionCookie);
    if (!encryptedSession) {
      return null;
    }
    try {
      const decrypted = await jwtDecrypt(encryptedSession, this.#key, {
        keyManagementAlgorithms: ["dir"],
        contentEncryptionAlgorithms: ["A256GCM"],
      });
      const session = storedSessionSchema.parse(decrypted.payload);
      const authorizationMode = session.authorization_mode ?? "off";
      if (authorizationMode !== this.#accessControl.mode) {
        return null;
      }
      return {
        subject: session.sub,
        displayName: session.name,
        ...(session.email ? { email: session.email } : {}),
        accessToken: session.access_token,
        accessTier: session.access_tier ?? "orders-full",
        ...(session.asserted_access_tier
          ? { assertedAccessTier: session.asserted_access_tier }
          : {}),
        accessTierClaimPresent: session.access_tier_claim_present ?? false,
        authorizationMode,
        csrfToken: session.csrf,
        expiresAt: session.exp,
      };
    } catch {
      return null;
    }
  }

  public async verifyAccessToken(accessToken: string): Promise<UserPrincipal> {
    try {
      const verification = await jwtVerify(accessToken, this.#jwks, {
        issuer: this.#config.issuer,
        audience: this.#config.audience ?? this.#config.clientId,
        algorithms: ["RS256"],
      });
      const subject = requiredStringClaim(verification.payload, "sub");
      const displayName =
        optionalStringClaim(verification.payload, "name") ??
        optionalStringClaim(verification.payload, "preferred_username") ??
        optionalStringClaim(verification.payload, "email") ??
        subject;
      const email = optionalStringClaim(verification.payload, "email");
      const authorization = resolveAccessTier(
        verification.payload,
        this.#accessControl,
      );
      return {
        subject,
        displayName,
        ...(email ? { email } : {}),
        accessToken,
        accessTier: authorization.accessTier,
        ...(authorization.assertedAccessTier
          ? { assertedAccessTier: authorization.assertedAccessTier }
          : {}),
        accessTierClaimPresent: authorization.claimPresent,
        authorizationMode: authorization.mode,
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError(
        "IBM Verify user access token validation failed",
        { cause: error },
      );
    }
  }

  public clearSessionCookies(): string[] {
    return [
      serializeCookie(sessionCookie, "", { maxAge: 0, path: "/" }),
      serializeCookie(transactionCookie, "", {
        maxAge: 0,
        path: "/",
      }),
    ];
  }

  async #exchangeAuthorizationCode(
    code: string,
    verifier: string,
  ): Promise<z.infer<typeof authorizationCodeResponseSchema>> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.#config.clientId,
      code,
      code_verifier: verifier,
      redirect_uri: this.#config.redirectUri,
    });
    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    };
    if (this.#config.clientSecret) {
      headers["authorization"] = `Basic ${Buffer.from(
        `${this.#config.clientId}:${this.#config.clientSecret}`,
        "utf8",
      ).toString("base64")}`;
    }

    let response;
    try {
      response = await request(this.#config.tokenUrl, {
        method: "POST",
        headers,
        body: body.toString(),
        bodyTimeout: 8_000,
        headersTimeout: 8_000,
      });
    } catch (error) {
      throw new ExternalServiceError(
        "IBM Verify",
        "authorization code exchange was unavailable",
        { cause: error },
      );
    }
    const responseText = await response.body.text();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new AuthenticationError(
        `IBM Verify rejected the authorization code (${String(response.statusCode)})`,
      );
    }
    try {
      return authorizationCodeResponseSchema.parse(JSON.parse(responseText));
    } catch (error) {
      throw new ExternalServiceError(
        "IBM Verify",
        "authorization code response was invalid",
        { cause: error },
      );
    }
  }
}

export class UnconfiguredUserAuth implements UserAuthenticator {
  public beginLogin(): Promise<never> {
    return Promise.reject(
      new ConfigurationError("IBM Verify user login is not configured"),
    );
  }

  public completeLogin(): Promise<never> {
    return Promise.reject(
      new ConfigurationError("IBM Verify user login is not configured"),
    );
  }

  public readSession(): Promise<null> {
    return Promise.resolve(null);
  }

  public verifyAccessToken(): Promise<never> {
    return Promise.reject(
      new ConfigurationError("IBM Verify user login is not configured"),
    );
  }

  public clearSessionCookies(): string[] {
    return [];
  }
}

const loginTransactionSchema = z
  .object({
    state: z.string().min(20),
    nonce: z.string().min(20),
    verifier: z.string().min(43),
    exp: z.number().int().positive(),
  })
  .loose();

const storedSessionSchema = z
  .object({
    sub: z.string().min(1),
    name: z.string().min(1),
    email: z.email().optional(),
    access_token: z.string().min(20),
    access_tier: z
      .enum(["orders-full", "orders-limited", "unapproved"])
      .optional(),
    asserted_access_tier: z.enum(["orders-full", "orders-limited"]).optional(),
    access_tier_claim_present: z.boolean().optional(),
    authorization_mode: z.enum(["off", "audit", "enforce"]).optional(),
    csrf: z.string().min(20),
    exp: z.number().int().positive(),
  })
  .loose();

function serializeCookie(
  name: string,
  value: string,
  options: { maxAge: number; path: string },
): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    `Max-Age=${String(options.maxAge)}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

function readCookie(
  cookieHeader: string | undefined,
  name: string,
): string | undefined {
  for (const entry of cookieHeader?.split(";") ?? []) {
    const [rawName, ...rawValue] = entry.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return undefined;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function singleQueryValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requiredStringClaim(payload: JWTPayload, claim: string): string {
  const value = payload[claim];
  if (typeof value !== "string" || value.length === 0) {
    throw new AuthenticationError(
      `IBM Verify token is missing the ${claim} claim`,
    );
  }
  return value;
}

function optionalStringClaim(
  payload: JWTPayload,
  claim: string,
): string | undefined {
  const value = payload[claim];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
