import { createHash, createPublicKey, randomUUID } from "node:crypto";

import {
  GetPublicKeyCommand,
  KMSClient,
  SignCommand,
  SigningAlgorithmSpec,
} from "@aws-sdk/client-kms";

import { ConfigurationError, ExternalServiceError } from "./errors.js";

interface KmsSignerConfig {
  region: string;
  keyId: string;
  clientId?: string;
  audience?: string;
}

export class KmsClientAssertionSigner {
  readonly #client: KMSClient;
  readonly #config: KmsSignerConfig;
  #descriptor?: Promise<{ kid: string; jwk: JsonWebKey }>;

  public constructor(
    config: KmsSignerConfig,
    client = new KMSClient({ region: config.region }),
  ) {
    this.#config = config;
    this.#client = client;
  }

  public async sign(): Promise<string> {
    if (!this.#config.clientId || !this.#config.audience) {
      throw new ConfigurationError(
        "IBM Verify client ID and token audience are not configured",
      );
    }
    const { kid } = await this.#getDescriptor();
    const now = Math.floor(Date.now() / 1000);
    const encodedHeader = encodeJson({ alg: "RS256", kid, typ: "JWT" });
    const encodedPayload = encodeJson({
      aud: this.#config.audience,
      exp: now + 60,
      iat: now,
      iss: this.#config.clientId,
      jti: randomUUID(),
      sub: this.#config.clientId,
    });
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const digest = createHash("sha256").update(signingInput, "utf8").digest();

    const response = await this.#client.send(
      new SignCommand({
        KeyId: this.#config.keyId,
        Message: digest,
        MessageType: "DIGEST",
        SigningAlgorithm: SigningAlgorithmSpec.RSASSA_PKCS1_V1_5_SHA_256,
      }),
    );
    if (!response.Signature) {
      throw new ExternalServiceError(
        "AWS KMS",
        "signing response did not contain a signature",
      );
    }

    return `${signingInput}.${Buffer.from(response.Signature).toString("base64url")}`;
  }

  public async publicJwk(): Promise<
    JsonWebKey & { kid: string; alg: string; use: string }
  > {
    const { kid, jwk } = await this.#getDescriptor();
    return { ...jwk, kid, alg: "RS256", use: "sig" };
  }

  async #getDescriptor(): Promise<{ kid: string; jwk: JsonWebKey }> {
    this.#descriptor ??= this.#loadDescriptor();
    return this.#descriptor;
  }

  async #loadDescriptor(): Promise<{ kid: string; jwk: JsonWebKey }> {
    const response = await this.#client.send(
      new GetPublicKeyCommand({ KeyId: this.#config.keyId }),
    );
    if (!response.PublicKey) {
      throw new ExternalServiceError(
        "AWS KMS",
        "public key response was empty",
      );
    }

    const publicKey = Buffer.from(response.PublicKey);
    const kid = createHash("sha256")
      .update(publicKey)
      .digest("base64url")
      .slice(0, 32);
    const jwk = createPublicKey({
      key: publicKey,
      format: "der",
      type: "spki",
    }).export({
      format: "jwk",
    });
    return { kid, jwk };
  }
}

function encodeJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
