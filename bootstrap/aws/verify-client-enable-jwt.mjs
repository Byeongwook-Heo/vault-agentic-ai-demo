import { request } from "undici";

import { KmsClientAssertionSigner } from "../../apps/mcp-server/dist/src/kms-signer.js";
import {
  buildVerifyManagementUrl,
  prepareVerifyClientUpdate,
  sanitizedVerifyErrorDetail,
  sanitizedUpdatePlan,
} from "./verify-client-enable-jwt-lib.mjs";

const mode = process.argv[2];
if (mode !== "plan" && mode !== "apply") {
  throw new Error("mode must be plan or apply");
}

const requiredNames = [
  "AWS_REGION",
  "PROJECT_NAME",
  "VERIFY_TOKEN_URL",
  "VERIFY_ISSUER",
  "VERIFY_CLIENT_ID",
  "VERIFY_MANAGER_CLIENT_ID",
  "VERIFY_KMS_KEY_ID",
];
for (const name of requiredNames) {
  if (!process.env[name]) {
    throw new Error(`${name} is required`);
  }
}
if (
  mode === "apply" &&
  process.env.CONFIRM_VERIFY_CLIENT_UPDATE !== process.env.PROJECT_NAME
) {
  throw new Error(
    "CONFIRM_VERIFY_CLIENT_UPDATE must equal PROJECT_NAME for apply",
  );
}
if (process.env.VERIFY_MANAGER_CLIENT_ID === process.env.VERIFY_CLIENT_ID) {
  throw new Error(
    "VERIFY_MANAGER_CLIENT_ID must be a separate temporary management client, not the target client",
  );
}

const tokenUrl = requireHttpsUrl(
  process.env.VERIFY_TOKEN_URL,
  "VERIFY_TOKEN_URL",
);
const managementUrl = buildVerifyManagementUrl(
  tokenUrl,
  process.env.VERIFY_ISSUER,
  process.env.VERIFY_CLIENT_ID,
);
const signer = new KmsClientAssertionSigner({
  region: process.env.AWS_REGION,
  keyId: process.env.VERIFY_KMS_KEY_ID,
  clientId: process.env.VERIFY_MANAGER_CLIENT_ID,
  audience: process.env.VERIFY_TOKEN_URL,
});
const accessToken = await requestAccessToken(
  signer,
  tokenUrl,
  process.env.VERIFY_MANAGER_CLIENT_ID,
);
const currentClient = await requestJson(managementUrl, {
  method: "GET",
  accessToken,
  operation: "read API client",
});
const updatedClient = prepareVerifyClientUpdate(
  currentClient,
  process.env.VERIFY_CLIENT_ID,
);
const plan = {
  ...sanitizedUpdatePlan(currentClient, updatedClient),
  usesSeparateManagerClient: true,
};

console.log(JSON.stringify(plan, null, 2));
if (mode === "plan") {
  console.log(
    "Plan only: IBM Verify was not changed. Apply requires the explicit confirmation guard.",
  );
  process.exit(0);
}
if (plan.unexpectedOmittedResponseFieldNames.length > 0) {
  throw new Error(
    `Refusing to omit unrecognized IBM Verify response fields: ${plan.unexpectedOmittedResponseFieldNames.join(", ")}`,
  );
}

await requestJson(managementUrl, {
  method: "PUT",
  accessToken,
  operation: "update API client",
  jsonBody: updatedClient,
  allowEmptyResponse: true,
});
console.log(
  "IBM Verify accepted the API client update: JWT access tokens enabled and temporary manageAPIClients entitlement removed.",
);

async function requestAccessToken(clientAssertionSigner, url, clientId) {
  const assertion = await clientAssertionSigner.sign();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
  });
  const response = await request(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "cache-control": "no-store",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    bodyTimeout: 10_000,
    headersTimeout: 10_000,
    maxRedirections: 0,
  });
  const responseText = await response.body.text();
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `IBM Verify rejected the provisioning client assertion (${response.statusCode})`,
    );
  }
  const tokenResponse = parseJson(responseText, "token response");
  if (
    !isPlainObject(tokenResponse) ||
    typeof tokenResponse.access_token !== "string" ||
    tokenResponse.access_token.length === 0
  ) {
    throw new Error("IBM Verify response did not contain an access token");
  }
  return tokenResponse.access_token;
}

async function requestJson(
  url,
  { method, accessToken, operation, jsonBody, allowEmptyResponse = false },
) {
  const response = await request(url, {
    method,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      "cache-control": "no-store",
      ...(jsonBody === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(jsonBody === undefined ? {} : { body: JSON.stringify(jsonBody) }),
    bodyTimeout: 10_000,
    headersTimeout: 10_000,
    maxRedirections: 0,
  });
  const responseText = await response.body.text();
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const safeDetail = sanitizedVerifyErrorDetail(responseText, [
      accessToken,
      ...(typeof jsonBody?.clientSecret === "string"
        ? [jsonBody.clientSecret]
        : []),
    ]);
    throw new Error(
      `IBM Verify failed to ${operation} (${response.statusCode})${safeDetail ? `: ${safeDetail}` : ""}`,
    );
  }
  if (allowEmptyResponse && responseText.trim().length === 0) {
    return {};
  }
  return parseJson(responseText, operation);
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`IBM Verify returned invalid JSON for ${label}`);
  }
}

function requireHttpsUrl(value, name) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS`);
  }
  return url;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
