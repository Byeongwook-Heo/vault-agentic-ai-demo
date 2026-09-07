import { describe, expect, it, vi } from "vitest";

import type { OrdersDatabase } from "../src/database.js";
import { AuthorizationError } from "../src/errors.js";
import { SecurityEventStore } from "../src/event-store.js";
import type { IdentityProvider } from "../src/identity-client.js";
import { ToolService } from "../src/tool-service.js";
import type { VaultCredentialBroker } from "../src/vault-client.js";

function buildService() {
  const identity: IdentityProvider = {
    getVerifiedAccessToken: vi
      .fn()
      .mockResolvedValue("header.payload.signature"),
  };
  const vault: VaultCredentialBroker = {
    withDatabaseCredentials: vi.fn(async (_jwt, accessTier, operation) =>
      operation({
        username: "dynamic-user",
        password: "dynamic-password",
        leaseId: "database/creds/example",
        leaseDurationSeconds: 120,
        accessTier,
      }),
    ),
    attemptDeniedDatabaseCredentials: vi
      .fn()
      .mockRejectedValue(new AuthorizationError("Vault policy denied access")),
    close: vi.fn(),
  };
  const database: OrdersDatabase = {
    getOrderStatus: vi.fn().mockResolvedValue({
      status: "found",
      order_id: "ORD-1001",
      payment_status: "PAID",
      delivery_status: "PREPARING",
      updated_at: "2026-07-30T00:00:00.000Z",
    }),
    getFailedPaymentSummary: vi.fn().mockResolvedValue({
      date: "2026-07-30",
      failed_count: 0,
      by_delivery_status: [],
    }),
    getRecentOrders: vi.fn().mockResolvedValue({
      orders: [
        {
          order_id: "ORD-1001",
          payment_status: "PAID",
          delivery_status: "PREPARING",
          updated_at: "2026-07-30T00:00:00.000Z",
        },
      ],
    }),
    getFailedPaymentTrend: vi.fn().mockResolvedValue({
      days: 7,
      points: [{ date: "2026-07-30", total_count: 1, failed_count: 0 }],
    }),
  };
  const events = new SecurityEventStore();
  return {
    identity,
    vault,
    database,
    events,
    service: new ToolService(identity, vault, database, events),
  };
}

describe("ToolService", () => {
  it("uses the verified JWT only inside the Vault broker", async () => {
    const fixture = buildService();

    const result = await fixture.service.getOrderStatus(
      "request-123",
      "ORD-1001",
    );

    expect(result.status).toBe("found");
    if (result.status !== "found") {
      throw new Error("Expected a visible order result");
    }
    expect(result.payment_status).toBe("PAID");
    expect(result.access.credential_ttl_seconds).toBe(120);
    expect(result.access.access_tier).toBe("orders-full");
    expect(fixture.identity.getVerifiedAccessToken).toHaveBeenCalledOnce();
    expect(fixture.vault.withDatabaseCredentials).toHaveBeenCalledOnce();
    expect(fixture.database.getOrderStatus).toHaveBeenCalledWith(
      expect.objectContaining({ username: "dynamic-user" }),
      "ORD-1001",
    );
    expect(fixture.events.list().map((event) => event.stage)).toEqual([
      "database",
      "vault",
      "identity",
    ]);
  });

  it("authenticates the NHI, then returns the expected Vault policy denial", async () => {
    const fixture = buildService();

    const result = await fixture.service.getSensitivePaymentData(
      "request-123",
      "CUS-1001",
    );

    expect(result).toMatchObject({
      authentication: "successful",
      authorization: "denied",
    });
    expect(fixture.identity.getVerifiedAccessToken).toHaveBeenCalledOnce();
    expect(fixture.vault.attemptDeniedDatabaseCredentials).toHaveBeenCalledWith(
      "header.payload.signature",
      "orders-full",
      "database/creds/bob-payment-pii",
    );
    expect(fixture.database.getOrderStatus).not.toHaveBeenCalled();
    expect(fixture.events.list()[0]).toMatchObject({
      stage: "vault",
      status: "denied",
    });
  });

  it("selects the limited Vault and database profile from the verified OBO identity", async () => {
    const fixture = buildService();

    await fixture.service.getOrderStatus("request-limited", "ORD-1001", {
      subject: "limited-user",
      subjectToken: "header.payload.signature.obo",
      accessTier: "orders-limited",
      assertedAccessTier: "orders-limited",
    });

    expect(fixture.vault.withDatabaseCredentials).toHaveBeenCalledWith(
      "header.payload.signature",
      "orders-limited",
      expect.any(Function),
    );
    expect(fixture.database.getOrderStatus).toHaveBeenCalledWith(
      expect.objectContaining({ accessTier: "orders-limited" }),
      "ORD-1001",
    );
  });

  it("records a scoped order miss as a denied data-return decision", async () => {
    const fixture = buildService();
    vi.mocked(fixture.database.getOrderStatus).mockResolvedValueOnce({
      status: "not_found_or_unauthorized",
    });

    const result = await fixture.service.getOrderStatus(
      "request-limited-miss",
      "ORD-1002",
      {
        subject: "limited-user",
        subjectToken: "header.payload.signature.obo",
        accessTier: "orders-limited",
        assertedAccessTier: "orders-limited",
      },
    );

    expect(result.status).toBe("not_found_or_unauthorized");
    expect(fixture.events.list()[0]).toMatchObject({
      stage: "database",
      status: "denied",
      action: "order_not_found_or_unauthorized",
    });
    expect(fixture.events.list()[1]).toMatchObject({
      stage: "vault",
      status: "allowed",
      action: "dynamic_credentials_issued",
    });
  });

  it("rejects an authenticated but unapproved OBO identity before Vault", async () => {
    const fixture = buildService();

    await expect(
      fixture.service.getOrderStatus("request-denied", "ORD-1001", {
        subject: "unapproved-user",
        subjectToken: "header.payload.signature.obo",
        accessTier: "unapproved",
      }),
    ).rejects.toThrow(/not authorized/);
    expect(fixture.vault.withDatabaseCredentials).not.toHaveBeenCalled();
    expect(fixture.database.getOrderStatus).not.toHaveBeenCalled();
  });

  it("executes the bounded recent-order and failure-trend queries", async () => {
    const fixture = buildService();

    const recent = await fixture.service.getRecentOrders("request-123", 5);
    const trend = await fixture.service.getFailedPaymentTrend("request-456", 7);

    expect(recent.orders).toHaveLength(1);
    expect(trend.points).toHaveLength(1);
    expect(fixture.database.getRecentOrders).toHaveBeenCalledWith(
      expect.objectContaining({ username: "dynamic-user" }),
      5,
    );
    expect(fixture.database.getFailedPaymentTrend).toHaveBeenCalledWith(
      expect.objectContaining({ username: "dynamic-user" }),
      7,
    );
  });
});
