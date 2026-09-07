import {
  createRemoteJWKSet,
  decodeJwt,
  decodeProtectedHeader,
  jwtVerify,
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
import type { KmsClientAssertionSigner } from "./kms-signer.js";

const tokenResponseSchema = z
  .object({
    access_token: z.string().min(20),
    token_type: z.string().min(1),
    expires_in: z.number().int().positive().optional(),
  })
  .loose();

export interface IdentityProvider {
  getVerifiedAccessToken(context?: IdentityContext): Promise<string>;
}

export interface IdentityContext {
  subjectToken: string;
  subject: string;
  accessTier?: EffectiveAccessTier;
  assertedAccessTier?: AccessTier;
}

interface IdentityClientConfig {
  tokenUrl: string;
  jwksUrl: string;
  issuer: string;
  audience: string;
  clientId: string;
  scope?: string;
  nhiClaim: string;
  nhiValue: string;
}

export class VerifyIdentityClient implements IdentityProvider {
  readonly #config: IdentityClientConfig;
  readonly #signer: KmsClientAssertionSigner;
  readonly #jwks: ReturnType<typeof createRemoteJWKSet>;

  public constructor(
    config: IdentityClientConfig,
    signer: KmsClientAssertionSigner,
  ) {
    this.#config = config;
    this.#signer = signer;
    this.#jwks = createRemoteJWKSet(new URL(config.jwksUrl), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
      timeoutDuration: 5_000,
    });
  }

  public async getVerifiedAccessToken(): Promise<string> {
    const assertion = await this.#signer.sign();
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.#config.clientId,
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: assertion,
      ...(this.#config.scope ? { scope: this.#config.scope } : {}),
    });

    let response;
    try {
      response = await request(this.#config.tokenUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        bodyTimeout: 5_000,
        headersTimeout: 5_000,
      });
    } catch (error) {
      throw new ExternalServiceError(
        "IBM Verify",
        "token endpoint was unavailable",
        {
          cause: error,
        },
      );
    }

    const responseText = await response.body.text();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new AuthenticationError(
        `IBM Verify rejected the client assertion (${String(response.statusCode)})`,
      );
    }

    let tokenResponse: z.infer<typeof tokenResponseSchema>;
    try {
      tokenResponse = tokenResponseSchema.parse(JSON.parse(responseText));
    } catch (error) {
      throw new ExternalServiceError(
        "IBM Verify",
        "token response was invalid",
        { cause: error },
      );
    }

    try {
      const verification = await jwtVerify(
        tokenResponse.access_token,
        this.#jwks,
        {
          issuer: this.#config.issuer,
          audience: this.#config.audience,
          algorithms: ["RS256"],
        },
      );
      const actualNhi = verification.payload[this.#config.nhiClaim];
      if (actualNhi !== this.#config.nhiValue) {
        throw new AuthenticationError(
          "IBM Verify token did not contain the required NHI binding",
        );
      }
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError(
        "IBM Verify access token validation failed",
        { cause: error },
      );
    }

    return tokenResponse.access_token;
  }
}

interface OboIdentityClientConfig {
  tokenUrl: string;
  jwksUrl: string;
  issuer: string;
  audience: string;
  clientId: string;
  scope?: string;
  actorClaim: string;
  actorValue: string;
  accessControl?: AccessTierConfig;
}

export interface VerifiedOboPrincipal {
  subject: string;
  displayName: string;
  email?: string;
  accessToken: string;
  accessTier?: EffectiveAccessTier;
  assertedAccessTier?: AccessTier;
  accessTierClaimPresent?: boolean;
  authorizationMode?: AccessTierEnforcementMode;
}

export interface OboTokenVerifier {
  verifyAccessToken(accessToken: string): Promise<VerifiedOboPrincipal>;
}

type OboTokenValidationConfig = Pick<
  OboIdentityClientConfig,
  | "jwksUrl"
  | "issuer"
  | "audience"
  | "actorClaim"
  | "actorValue"
  | "accessControl"
>;

function describeOboJwtValidationFailure(
  token: string,
  config: Pick<OboIdentityClientConfig, "issuer" | "audience">,
  error: unknown,
): string {
  const errorCode =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "JWT_VALIDATION_ERROR";
  try {
    const header = decodeProtectedHeader(token);
    const payload = decodeJwt(token);
    const actualAudience = Array.isArray(payload.aud)
      ? payload.aud.join(",")
      : (payload.aud ?? "missing");
    return [
      "IBM Verify OBO token validation failed",
      `reason=${errorCode}`,
      `alg=${header.alg ?? "missing"}`,
      `issuer=${payload.iss ?? "missing"}`,
      `expected_issuer=${config.issuer}`,
      `audience=${actualAudience}`,
      `expected_audience=${config.audience}`,
    ].join("; ");
  } catch {
    return `IBM Verify OBO token validation failed; reason=${errorCode}; token_shape=invalid_jwt`;
  }
}

export class VerifyOboIdentityClient implements IdentityProvider {
  readonly #config: OboIdentityClientConfig;
  readonly #signer: KmsClientAssertionSigner;
  readonly #jwks: ReturnType<typeof createRemoteJWKSet>;
  readonly #accessControl: AccessTierConfig;

  public constructor(
    config: OboIdentityClientConfig,
    signer: KmsClientAssertionSigner,
  ) {
    this.#config = config;
    this.#accessControl = config.accessControl ?? defaultAccessTierConfig;
    this.#signer = signer;
    this.#jwks = createRemoteJWKSet(new URL(config.jwksUrl), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
      timeoutDuration: 5_000,
    });
  }

  public async getVerifiedAccessToken(
    context?: IdentityContext,
  ): Promise<string> {
    if (!context) {
      throw new AuthenticationError(
        "A verified user token is required for the OBO exchange",
      );
    }
    const assertion = await this.#signer.sign();
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      client_id: this.#config.clientId,
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: assertion,
      subject_token: context.subjectToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      audience: this.#config.audience,
      ...(this.#config.scope ? { scope: this.#config.scope } : {}),
    });

    let response;
    try {
      response = await request(this.#config.tokenUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        bodyTimeout: 8_000,
        headersTimeout: 8_000,
      });
    } catch (error) {
      throw new ExternalServiceError(
        "IBM Verify",
        "OBO token exchange endpoint was unavailable",
        { cause: error },
      );
    }

    const responseText = await response.body.text();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new AuthenticationError(
        `IBM Verify rejected the OBO token exchange (${String(response.statusCode)})`,
      );
    }
    let tokenResponse: z.infer<typeof tokenResponseSchema>;
    try {
      tokenResponse = tokenResponseSchema.parse(JSON.parse(responseText));
    } catch (error) {
      throw new ExternalServiceError(
        "IBM Verify",
        "OBO token response was invalid",
        { cause: error },
      );
    }

    try {
      const verification = await jwtVerify(
        tokenResponse.access_token,
        this.#jwks,
        {
          issuer: this.#config.issuer,
          audience: this.#config.audience,
          algorithms: ["RS256"],
        },
      );
      if (verification.payload.sub !== context.subject) {
        throw new AuthenticationError(
          "IBM Verify OBO token did not preserve the user subject",
        );
      }
      if (
        verification.payload[this.#config.actorClaim] !==
        this.#config.actorValue
      ) {
        throw new AuthenticationError(
          "IBM Verify OBO token did not contain the required agent binding",
        );
      }
      const authorization = resolveAccessTier(
        verification.payload,
        this.#accessControl,
      );
      if (
        this.#accessControl.mode === "enforce" &&
        (authorization.accessTier === "unapproved" ||
          authorization.accessTier !== context.accessTier)
      ) {
        throw new AuthenticationError(
          "IBM Verify OBO token did not preserve the required access tier",
        );
      }
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError(
        describeOboJwtValidationFailure(
          tokenResponse.access_token,
          this.#config,
          error,
        ),
        { cause: error },
      );
    }

    return tokenResponse.access_token;
  }
}

export class VerifyOboTokenVerifier implements OboTokenVerifier {
  readonly #config: OboTokenValidationConfig;
  readonly #jwks: ReturnType<typeof createRemoteJWKSet>;
  readonly #accessControl: AccessTierConfig;

  public constructor(config: OboTokenValidationConfig) {
    this.#config = config;
    this.#accessControl = config.accessControl ?? defaultAccessTierConfig;
    this.#jwks = createRemoteJWKSet(new URL(config.jwksUrl), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
      timeoutDuration: 5_000,
    });
  }

  public async verifyAccessToken(
    accessToken: string,
  ): Promise<VerifiedOboPrincipal> {
    try {
      const verification = await jwtVerify(accessToken, this.#jwks, {
        issuer: this.#config.issuer,
        audience: this.#config.audience,
        algorithms: ["RS256"],
      });
      const subject = requiredStringClaim(verification.payload, "sub");
      if (
        verification.payload[this.#config.actorClaim] !==
        this.#config.actorValue
      ) {
        throw new AuthenticationError(
          "IBM Verify OBO token did not contain the required agent binding",
        );
      }
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
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError(
        describeOboJwtValidationFailure(accessToken, this.#config, error),
        { cause: error },
      );
    }
  }
}

export class PreverifiedIdentityClient implements IdentityProvider {
  public getVerifiedAccessToken(context?: IdentityContext): Promise<string> {
    if (!context) {
      return Promise.reject(
        new AuthenticationError("A verified OBO token is required"),
      );
    }
    return Promise.resolve(context.subjectToken);
  }
}

export class UnconfiguredIdentityClient implements IdentityProvider {
  public getVerifiedAccessToken(): Promise<string> {
    return Promise.reject(
      new ConfigurationError(
        "Identity flow is not configured yet; add the IBM Verify values and switch APP_MODE to aws",
      ),
    );
  }
}

function requiredStringClaim(
  payload: Record<string, unknown>,
  claim: string,
): string {
  const value = payload[claim];
  if (typeof value !== "string" || value.length === 0) {
    throw new AuthenticationError(
      `IBM Verify OBO token is missing the ${claim} claim`,
    );
  }
  return value;
}

function optionalStringClaim(
  payload: Record<string, unknown>,
  claim: string,
): string | undefined {
  const value = payload[claim];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
