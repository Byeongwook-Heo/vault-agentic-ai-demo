import { describe, expect, it } from "vitest";

import { resolveAccessTier } from "../src/access-control.js";

const config = {
  mode: "audit" as const,
  claim: "access_tier",
  fullValue: "orders-full",
  limitedValue: "orders-limited",
};

describe("resolveAccessTier", () => {
  it("keeps existing access in audit mode while recording a missing claim", () => {
    expect(resolveAccessTier({}, config)).toEqual({
      accessTier: "orders-full",
      claimPresent: false,
      mode: "audit",
    });
  });

  it("records a limited assertion without enforcing it in audit mode", () => {
    expect(
      resolveAccessTier({ access_tier: "orders-limited" }, config),
    ).toEqual({
      accessTier: "orders-full",
      assertedAccessTier: "orders-limited",
      claimPresent: true,
      mode: "audit",
    });
  });

  it("enforces full and limited signed claim values", () => {
    const enforce = { ...config, mode: "enforce" as const };

    expect(
      resolveAccessTier({ access_tier: "orders-full" }, enforce).accessTier,
    ).toBe("orders-full");
    expect(
      resolveAccessTier({ access_tier: ["orders-limited"] }, enforce)
        .accessTier,
    ).toBe("orders-limited");
  });

  it("fails closed for missing, unknown, or ambiguous values in enforce mode", () => {
    const enforce = { ...config, mode: "enforce" as const };

    expect(resolveAccessTier({}, enforce).accessTier).toBe("unapproved");
    expect(
      resolveAccessTier({ access_tier: "unknown" }, enforce).accessTier,
    ).toBe("unapproved");
    expect(
      resolveAccessTier(
        { access_tier: ["orders-full", "orders-limited"] },
        enforce,
      ).accessTier,
    ).toBe("unapproved");
  });
});
