import { createRemoteJWKSet, jwtVerify } from "jose";
import { request } from "undici";

import { KmsClientAssertionSigner } from "../../apps/mcp-server/dist/src/kms-signer.js";

const requiredNames = [
  "AWS_REGION",
  "VERIFY_TOKEN_URL",
  "VERIFY_JWKS_URL",
  "VERIFY_ISSUER",
  "VERIFY_AUDIENCE",
  "VERIFY_CLIENT_ID",
  "VERIFY_NHI_CLAIM",
  "VERIFY_NHI_VALUE",
  "VERIFY_KMS_KEY_ID",
];
for (const name of requiredNames) {
  if (!process.env[name]) {
    throw new Error(`${name} is required`);
  }
}

const signer = new KmsClientAssertionSigner({
  region: process.env.AWS_REGION,
  keyId: process.env.VERIFY_KMS_KEY_ID,
  clientId: process.env.VERIFY_CLIENT_ID,
  audience: process.env.VERIFY_TOKEN_URL,
});
const assertion = await signer.sign();
const body = new URLSearchParams({
  grant_type: "client_credentials",
  client_id: process.env.VERIFY_CLIENT_ID,
  client_assertion_type:
    "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
  client_assertion: assertion,
  ...(process.env.VERIFY_SCOPE ? { scope: process.env.VERIFY_SCOPE } : {}),
});
const response = await request(process.env.VERIFY_TOKEN_URL, {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/x-www-form-urlencoded",
  },
  body: body.toString(),
  bodyTimeout: 5_000,
  headersTimeout: 5_000,
  maxRedirections: 0,
});
const responseText = await response.body.text();
if (response.statusCode < 200 || response.statusCode >= 300) {
  throw new Error(
    `IBM Verify rejected the client assertion (${response.statusCode})`,
  );
}
const tokenResponse = JSON.parse(responseText);
if (typeof tokenResponse.access_token !== "string") {
  throw new Error("IBM Verify response did not contain an access token");
}

const jwks = createRemoteJWKSet(new URL(process.env.VERIFY_JWKS_URL), {
  timeoutDuration: 5_000,
});
const verification = await jwtVerify(tokenResponse.access_token, jwks, {
  issuer: process.env.VERIFY_ISSUER,
  audience: process.env.VERIFY_AUDIENCE,
  algorithms: ["RS256"],
});
if (
  verification.payload[process.env.VERIFY_NHI_CLAIM] !==
  process.env.VERIFY_NHI_VALUE
) {
  throw new Error("IBM Verify token did not contain the expected NHI binding");
}

console.log(
  "IBM Verify issued a cryptographically valid JWT with the expected issuer, audience, expiry, and NHI binding.",
);
