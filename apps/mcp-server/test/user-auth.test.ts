import { createServer, type Server } from "node:http";

import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, describe, expect, it } from "vitest";

import { VerifyUserAuth } from "../src/user-auth.js";

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

describe("VerifyUserAuth", () => {
  it("completes PKCE login and keeps the access token inside the encrypted session", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const publicJwk = await exportJWK(publicKey);
    const issuer = "https://verify.example.test/oidc/endpoint/default";
    const clientId = "chatbot-client";
    let expectedNonce = "";
    let receivedCodeVerifier = "";

    server = createServer((request, response) => {
      if (request.url === "/jwks") {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            keys: [
              {
                ...publicJwk,
                kid: "user-test-key",
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
        const parameters = new URLSearchParams(body);
        receivedCodeVerifier = parameters.get("code_verifier") ?? "";
        const common = () =>
          new SignJWT({
            name: "Demo User",
            email: "demo@example.test",
            access_tier: "orders-limited",
          })
            .setProtectedHeader({ alg: "RS256", kid: "user-test-key" })
            .setIssuer(issuer)
            .setAudience(clientId)
            .setSubject("user-123")
            .setIssuedAt()
            .setExpirationTime("10m");
        void Promise.all([
          common().sign(privateKey),
          new SignJWT({
            name: "Demo User",
            email: "demo@example.test",
            nonce: expectedNonce,
          })
            .setProtectedHeader({ alg: "RS256", kid: "user-test-key" })
            .setIssuer(issuer)
            .setAudience(clientId)
            .setSubject("user-123")
            .setIssuedAt()
            .setExpirationTime("10m")
            .sign(privateKey),
        ]).then(([accessToken, idToken]) => {
          response.setHeader("content-type", "application/json");
          response.end(
            JSON.stringify({
              access_token: accessToken,
              id_token: idToken,
              token_type: "bearer",
              expires_in: 600,
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
    const auth = new VerifyUserAuth({
      authorizationUrl: `${baseUrl}/authorize`,
      tokenUrl: `${baseUrl}/token`,
      jwksUrl: `${baseUrl}/jwks`,
      issuer,
      clientId,
      scopes: "openid profile vault.db.read",
      redirectUri: "https://chat.example.test/auth/callback",
      sessionSecret: "session-secret-for-tests-".padEnd(48, "x"),
      accessControl: {
        mode: "enforce",
        claim: "access_tier",
        fullValue: "orders-full",
        limitedValue: "orders-limited",
      },
    });

    const login = await auth.beginLogin();
    expect(login.setCookie).toContain("Path=/;");
    expect(login.setCookie).toContain("HttpOnly; Secure; SameSite=Lax");
    const authorization = new URL(login.redirectUrl);
    expect(authorization.searchParams.get("prompt")).toBe("login");
    expect(authorization.searchParams.get("max_age")).toBe("0");
    expectedNonce = authorization.searchParams.get("nonce") ?? "";
    const state = authorization.searchParams.get("state") ?? "";
    const transactionCookie = login.setCookie.split(";")[0];
    const callback = await auth.completeLogin(
      { code: "authorization-code", state },
      transactionCookie,
    );
    const sessionCookie = callback.setCookies
      .find((cookie) => cookie.startsWith("__Host-chat-session="))
      ?.split(";")[0];
    const session = await auth.readSession(sessionCookie);

    expect(receivedCodeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(session).toMatchObject({
      subject: "user-123",
      displayName: "Demo User",
      email: "demo@example.test",
      accessTier: "orders-limited",
      assertedAccessTier: "orders-limited",
      accessTierClaimPresent: true,
      authorizationMode: "enforce",
    });
    expect(session?.csrfToken.length).toBeGreaterThanOrEqual(20);
    expect(callback.setCookies.join(";")).not.toContain(
      session?.accessToken ?? "missing",
    );

    const staleModeReader = new VerifyUserAuth({
      authorizationUrl: `${baseUrl}/authorize`,
      tokenUrl: `${baseUrl}/token`,
      jwksUrl: `${baseUrl}/jwks`,
      issuer,
      clientId,
      scopes: "openid profile vault.db.read",
      redirectUri: "https://chat.example.test/auth/callback",
      sessionSecret: "session-secret-for-tests-".padEnd(48, "x"),
      accessControl: {
        mode: "audit",
        claim: "access_tier",
        fullValue: "orders-full",
        limitedValue: "orders-limited",
      },
    });
    await expect(
      staleModeReader.readSession(sessionCookie),
    ).resolves.toBeNull();
  });
});
