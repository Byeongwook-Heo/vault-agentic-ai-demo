import { createServer, type Server } from "node:http";

import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VerifyOboIdentityClient } from "../src/identity-client.js";
import type { KmsClientAssertionSigner } from "../src/kms-signer.js";

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

describe("VerifyOboIdentityClient", () => {
  it("exchanges the user token and validates subject plus Agent binding", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const publicJwk = await exportJWK(publicKey);
    const issuer = "https://verify.example.test/oauth2";
    const audience = "vault-orders";
    const clientId = "agent-sts-client";
    let receivedBody = new URLSearchParams();

    server = createServer((request, response) => {
      if (request.url === "/jwks") {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            keys: [
              {
                ...publicJwk,
                kid: "verify-test-key",
                alg: "RS256",
                use: "sig",
              },
            ],
          }),
        );
        return;
      }
      if (request.url !== "/token" || request.method !== "POST") {
        response.statusCode = 404;
        response.end();
        return;
      }
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => {
        body += chunk;
      });
      request.on("end", () => {
        receivedBody = new URLSearchParams(body);
        void new SignJWT({
          client_id: clientId,
          access_tier: "orders-limited",
        })
          .setProtectedHeader({ alg: "RS256", kid: "verify-test-key" })
          .setIssuer(issuer)
          .setAudience(audience)
          .setSubject("user-123")
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(privateKey)
          .then((accessToken) => {
            response.setHeader("content-type", "application/json");
            response.end(
              JSON.stringify({
                access_token: accessToken,
                token_type: "bearer",
                expires_in: 300,
              }),
            );
          });
      });
    });
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("test server did not bind");
    }
    const baseUrl = `http://127.0.0.1:${String(address.port)}`;
    const signer = {
      sign: vi.fn().mockResolvedValue("kms-client-assertion"),
    } as unknown as KmsClientAssertionSigner;
    const client = new VerifyOboIdentityClient(
      {
        tokenUrl: `${baseUrl}/token`,
        jwksUrl: `${baseUrl}/jwks`,
        issuer,
        audience,
        clientId,
        scope: "vault.db.read",
        actorClaim: "client_id",
        actorValue: clientId,
        accessControl: {
          mode: "enforce",
          claim: "access_tier",
          fullValue: "orders-full",
          limitedValue: "orders-limited",
        },
      },
      signer,
    );

    const token = await client.getVerifiedAccessToken({
      subject: "user-123",
      subjectToken: "header.payload.signature.user",
      accessTier: "orders-limited",
      assertedAccessTier: "orders-limited",
    });

    expect(token.split(".")).toHaveLength(3);
    expect(receivedBody.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:token-exchange",
    );
    expect(receivedBody.get("subject_token_type")).toBe(
      "urn:ietf:params:oauth:token-type:access_token",
    );
    expect(receivedBody.get("audience")).toBe(audience);
    expect(receivedBody.get("client_assertion")).toBe("kms-client-assertion");
  });
});
