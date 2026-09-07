import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVerifyManagementUrl,
  prepareVerifyClientUpdate,
  sanitizedVerifyErrorDetail,
  sanitizedUpdatePlan,
} from "./verify-client-enable-jwt-lib.mjs";

const clientId = "00000000-0000-4000-8000-000000000001";

function client(overrides = {}) {
  return {
    clientId,
    clientName: "bob-vault-nhi-demo",
    clientSecret: "preserved-but-never-logged",
    enabled: true,
    entitlements: ["readUsers", "manageAPIClients"],
    accessTokenType: "default",
    jwkUri: "https://bob-vault-demo.example.test/.well-known/jwks.json",
    restrictScopes: true,
    scopes: [{ name: "vault.db.read", description: "Vault DB read" }],
    additionalConfig: {
      clientAuthMethod: "private_key_jwt",
      validateJti: true,
    },
    id: "read-only-internal-id",
    _links: {
      self: {
        href: `/v1.0/apiclients/${clientId}`,
      },
    },
    ...overrides,
  };
}

test("builds the management URL only on the configured Verify tenant", () => {
  const managementUrl = buildVerifyManagementUrl(
    "https://tenant.verify.ibm.com/v1.0/endpoint/default/token",
    "https://tenant.verify.ibm.com/oidc/endpoint/default",
    clientId,
  );

  assert.equal(
    managementUrl.href,
    `https://tenant.verify.ibm.com/v1.0/apiclients/${clientId}`,
  );
  assert.throws(
    () =>
      buildVerifyManagementUrl(
        "https://tenant.verify.ibm.com/v1.0/endpoint/default/token",
        "https://different.verify.ibm.com/oidc/endpoint/default",
        clientId,
      ),
    /same tenant origin/,
  );
});

test("enables JWT and removes only the temporary admin entitlement", () => {
  const current = client();
  const updated = prepareVerifyClientUpdate(current, clientId);

  assert.equal(updated.accessTokenType, "jwt");
  assert.equal(updated.idTokenSigningAlg, "RS256");
  assert.deepEqual(updated.entitlements, ["readUsers"]);
  assert.equal(updated.clientSecret, current.clientSecret);
  assert.equal(updated.jwkUri, current.jwkUri);
  assert.equal(updated.restrictScopes, true);
  assert.deepEqual(updated.scopes, current.scopes);
  assert.deepEqual(updated.additionalConfig, current.additionalConfig);
  assert.equal(updated.clientId, current.clientId);
  assert.equal(Object.hasOwn(updated, "id"), false);
  assert.equal(Object.hasOwn(updated, "_links"), false);
});

test("sanitized plan never includes the client secret value", () => {
  const current = client();
  const updated = prepareVerifyClientUpdate(current, clientId);
  const plan = sanitizedUpdatePlan(current, updated);

  assert.deepEqual(plan, {
    clientId,
    currentAccessTokenType: "default",
    requestedAccessTokenType: "jwt",
    requestedJwtSigningAlgorithm: "RS256",
    removesTemporaryAdminEntitlement: true,
    preservedEntitlementCount: 1,
    preservesClientSecret: true,
    preservesJwksUri: true,
    submittedFieldNames: [
      "accessTokenType",
      "additionalConfig",
      "clientId",
      "clientName",
      "clientSecret",
      "enabled",
      "entitlements",
      "idTokenSigningAlg",
      "jwkUri",
      "restrictScopes",
      "scopes",
    ],
    omittedResponseFieldNames: ["_links", "id"],
    unexpectedOmittedResponseFieldNames: [],
  });
  assert.equal(JSON.stringify(plan).includes(current.clientSecret), false);
});

test("reports response fields that are unsafe to omit from an update", () => {
  const current = client({ tenantSpecificSetting: "preserve-me" });
  const updated = prepareVerifyClientUpdate(current, clientId);
  const plan = sanitizedUpdatePlan(current, updated);

  assert.deepEqual(plan.unexpectedOmittedResponseFieldNames, [
    "tenantSpecificSetting",
  ]);
});

test("extracts useful Verify errors without exposing credentials", () => {
  const secret = "client-secret-value";
  const accessToken = "management-access-token";
  const detail = sanitizedVerifyErrorDetail(
    JSON.stringify({
      error: "invalid_request",
      error_description: `Invalid accessTokenType; ${secret}`,
      request: {
        clientSecret: secret,
        access_token: accessToken,
      },
      errors: [
        {
          field: "accessTokenType",
          message: "Unsupported value",
        },
      ],
    }),
    [secret, accessToken],
  );

  assert.match(detail, /invalid_request/);
  assert.match(detail, /accessTokenType/);
  assert.match(detail, /\[REDACTED\]/);
  assert.equal(detail.includes(secret), false);
  assert.equal(detail.includes(accessToken), false);
});

test("refuses an update if the management entitlement is absent", () => {
  assert.throws(
    () =>
      prepareVerifyClientUpdate(
        client({ entitlements: ["readUsers"] }),
        clientId,
      ),
    /manageAPIClients/,
  );
});

test("refuses an update that could rotate a missing client secret", () => {
  assert.throws(
    () =>
      prepareVerifyClientUpdate(client({ clientSecret: undefined }), clientId),
    /rotate/,
  );
});

test("refuses a mismatched client ID and an insecure JWKS URI", () => {
  assert.throws(
    () => prepareVerifyClientUpdate(client(), "different-client"),
    /different client ID/,
  );
  assert.throws(
    () =>
      prepareVerifyClientUpdate(
        client({ jwkUri: "http://example.test/jwks" }),
        clientId,
      ),
    /HTTPS JWKS URI/,
  );
});
