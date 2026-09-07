import type { JWTPayload } from "jose";

export type AccessTier = "orders-full" | "orders-limited";
export type EffectiveAccessTier = AccessTier | "unapproved";
export type AccessTierEnforcementMode = "off" | "audit" | "enforce";

export interface AccessTierConfig {
  mode: AccessTierEnforcementMode;
  claim: string;
  fullValue: string;
  limitedValue: string;
}

export interface AccessTierResolution {
  accessTier: EffectiveAccessTier;
  assertedAccessTier?: AccessTier;
  claimPresent: boolean;
  mode: AccessTierEnforcementMode;
}

export const defaultAccessTierConfig: AccessTierConfig = {
  mode: "off",
  claim: "access_tier",
  fullValue: "orders-full",
  limitedValue: "orders-limited",
};

export function resolveAccessTier(
  payload: JWTPayload,
  config: AccessTierConfig = defaultAccessTierConfig,
): AccessTierResolution {
  const rawClaim = payload[config.claim];
  const values = Array.isArray(rawClaim)
    ? rawClaim.filter((value): value is string => typeof value === "string")
    : typeof rawClaim === "string"
      ? [rawClaim]
      : [];
  const asserted = assertedTier(values, config);
  const claimPresent = rawClaim !== undefined;

  if (config.mode === "enforce") {
    return {
      accessTier: asserted ?? "unapproved",
      ...(asserted ? { assertedAccessTier: asserted } : {}),
      claimPresent,
      mode: config.mode,
    };
  }

  return {
    accessTier: "orders-full",
    ...(asserted ? { assertedAccessTier: asserted } : {}),
    claimPresent,
    mode: config.mode,
  };
}

export function accessTierLabel(tier: EffectiveAccessTier): string {
  switch (tier) {
    case "orders-full":
      return "전체 주문 조회";
    case "orders-limited":
      return "제한 주문 조회";
    case "unapproved":
      return "보호 데이터 미승인";
  }
}

function assertedTier(
  values: string[],
  config: AccessTierConfig,
): AccessTier | undefined {
  const hasFull = values.includes(config.fullValue);
  const hasLimited = values.includes(config.limitedValue);
  if (hasFull === hasLimited) return undefined;
  return hasFull ? "orders-full" : "orders-limited";
}
