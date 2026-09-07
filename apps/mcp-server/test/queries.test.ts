import { describe, expect, it } from "vitest";

import { orderQueries } from "../src/queries.js";

describe("orderQueries", () => {
  it("selects only the fixed full-order view for the full tier", () => {
    const queries = Object.values(orderQueries("orders-full")).join("\n");

    expect(queries).toContain("v_bob_order_status_full");
    expect(queries).not.toContain("v_bob_order_status_limited");
  });

  it("selects only the fixed limited-order view for the limited tier", () => {
    const queries = Object.values(orderQueries("orders-limited")).join("\n");

    expect(queries).toContain("v_bob_order_status_limited");
    expect(queries).not.toContain("v_bob_order_status_full");
  });
});
