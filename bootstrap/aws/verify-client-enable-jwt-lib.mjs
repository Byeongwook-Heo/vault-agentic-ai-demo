const ADMIN_ENTITLEMENT = "manageAPIClients";
const READ_ONLY_RESPONSE_FIELD_NAMES = new Set(["_links", "id"]);
const SAFE_ERROR_FIELD_PATTERN =
  /(error|message|detail|reason|cause|code|status|field|path|invalid)/i;
const UPDATE_FIELD_NAMES = Object.freeze([
  "clientName",
  "clientId",
  "entitlements",
  "clientSecret",
  "enabled",
  "overrideSettings",
  "description",
  "additionalProperties",
  "ipFilterOp",
  "ipFilters",
  "jwkUri",
  "additionalConfig",
  "idTokenSigningAlg",
  "accessTokenType",
  "restrictScopes",
  "scopes",
]);

export function buildVerifyManagementUrl(tokenUrlValue, issuerValue, clientId) {
  const tokenUrl = requireHttpsUrl(tokenUrlValue, "VERIFY_TOKEN_URL");
  const issuerUrl = requireHttpsUrl(issuerValue, "VERIFY_ISSUER");
  if (tokenUrl.origin !== issuerUrl.origin) {
    throw new Error(
      "VERIFY_TOKEN_URL and VERIFY_ISSUER must use the same tenant origin",
    );
  }
  if (typeof clientId !== "string" || clientId.length === 0) {
    throw new Error("VERIFY_CLIENT_ID is required");
  }

  return new URL(
    `/v1.0/apiclients/${encodeURIComponent(clientId)}`,
    tokenUrl.origin,
  );
}

export function prepareVerifyClientUpdate(value, expectedClientId) {
  if (!isPlainObject(value)) {
    throw new Error("IBM Verify API client response was not an object");
  }
  if (value.clientId !== expectedClientId) {
    throw new Error("IBM Verify API returned a different client ID");
  }
  if (typeof value.clientName !== "string" || value.clientName.length === 0) {
    throw new Error("IBM Verify API client response did not contain a name");
  }
  if (
    typeof value.clientSecret !== "string" ||
    value.clientSecret.length === 0
  ) {
    throw new Error(
      "IBM Verify API client response omitted the client secret; refusing an update that could rotate it",
    );
  }
  if (!Array.isArray(value.entitlements)) {
    throw new Error(
      "IBM Verify API client response did not contain entitlements",
    );
  }
  if (!value.entitlements.every((item) => typeof item === "string")) {
    throw new Error("IBM Verify API client entitlements were malformed");
  }
  if (!value.entitlements.includes(ADMIN_ENTITLEMENT)) {
    throw new Error(
      "The API client does not have the temporary manageAPIClients entitlement",
    );
  }
  if (typeof value.jwkUri !== "string" || !isHttpsUrl(value.jwkUri)) {
    throw new Error("The API client does not contain a valid HTTPS JWKS URI");
  }

  const update = {};
  for (const fieldName of UPDATE_FIELD_NAMES) {
    if (Object.hasOwn(value, fieldName)) {
      update[fieldName] = value[fieldName];
    }
  }
  update.accessTokenType = "jwt";
  update.idTokenSigningAlg = "RS256";
  update.entitlements = value.entitlements.filter(
    (entitlement) => entitlement !== ADMIN_ENTITLEMENT,
  );
  return update;
}

export function sanitizedUpdatePlan(current, updated) {
  const omittedResponseFieldNames = Object.keys(current)
    .filter((fieldName) => !Object.hasOwn(updated, fieldName))
    .sort();
  return {
    clientId: current.clientId,
    currentAccessTokenType: current.accessTokenType ?? "default",
    requestedAccessTokenType: updated.accessTokenType,
    requestedJwtSigningAlgorithm: updated.idTokenSigningAlg,
    removesTemporaryAdminEntitlement:
      current.entitlements.includes(ADMIN_ENTITLEMENT) &&
      !updated.entitlements.includes(ADMIN_ENTITLEMENT),
    preservedEntitlementCount: updated.entitlements.length,
    preservesClientSecret:
      current.clientSecret === updated.clientSecret &&
      typeof updated.clientSecret === "string",
    preservesJwksUri: current.jwkUri === updated.jwkUri,
    submittedFieldNames: Object.keys(updated).sort(),
    omittedResponseFieldNames,
    unexpectedOmittedResponseFieldNames: omittedResponseFieldNames.filter(
      (fieldName) => !READ_ONLY_RESPONSE_FIELD_NAMES.has(fieldName),
    ),
  };
}

export function sanitizedVerifyErrorDetail(responseText, sensitiveValues = []) {
  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    const text = redactSensitiveText(responseText, sensitiveValues).trim();
    return text.length > 0 ? text.slice(0, 1_000) : undefined;
  }

  const safeFields = {};
  collectSafeErrorFields(parsed, "", safeFields, sensitiveValues);
  if (Object.keys(safeFields).length === 0) {
    return undefined;
  }
  return JSON.stringify(safeFields).slice(0, 2_000);
}

function collectSafeErrorFields(value, path, output, sensitiveValues) {
  if (Array.isArray(value)) {
    value.slice(0, 10).forEach((item, index) => {
      collectSafeErrorFields(
        item,
        `${path}[${index}]`,
        output,
        sensitiveValues,
      );
    });
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, fieldValue] of Object.entries(value)) {
    const fieldPath = path ? `${path}.${key}` : key;
    if (
      SAFE_ERROR_FIELD_PATTERN.test(key) &&
      (typeof fieldValue === "string" ||
        typeof fieldValue === "number" ||
        typeof fieldValue === "boolean")
    ) {
      output[fieldPath] =
        typeof fieldValue === "string"
          ? redactSensitiveText(fieldValue, sensitiveValues).slice(0, 500)
          : fieldValue;
    }
    if (Array.isArray(fieldValue) || isPlainObject(fieldValue)) {
      collectSafeErrorFields(fieldValue, fieldPath, output, sensitiveValues);
    }
  }
}

function redactSensitiveText(value, sensitiveValues) {
  let redacted = value;
  for (const sensitiveValue of sensitiveValues) {
    if (typeof sensitiveValue === "string" && sensitiveValue.length > 0) {
      redacted = redacted.split(sensitiveValue).join("[REDACTED]");
    }
  }
  return redacted
    .replace(
      /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
      "[REDACTED_JWT]",
    )
    .replace(
      /("(?:clientSecret|client_secret|access_token|client_assertion)"\s*:\s*")[^"]*(")/gi,
      "$1[REDACTED]$2",
    );
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function requireHttpsUrl(value, name) {
  let url;
  try {
    url = value instanceof URL ? value : new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS`);
  }
  return url;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
