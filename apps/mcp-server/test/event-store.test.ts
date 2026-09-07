import { describe, expect, it, vi } from "vitest";

import { SecurityEventStore } from "../src/event-store.js";

describe("SecurityEventStore", () => {
  it("sanitizes action text and bounds list size", () => {
    const events = new SecurityEventStore();
    for (let index = 0; index < 110; index += 1) {
      events.record({
        stage: "policy",
        status: "denied",
        action: `read_<secret>_${String(index)}`,
        requestId: `request-${String(index)}`,
      });
    }

    const stored = events.list(100);
    expect(stored).toHaveLength(100);
    expect(stored[0]?.action).not.toContain("<");
    expect(stored[0]?.action).not.toContain(">");
  });

  it("drops expired events", () => {
    vi.useFakeTimers();
    const events = new SecurityEventStore();
    events.record({
      stage: "transport",
      status: "allowed",
      action: "mcp_request_authenticated",
      requestId: "request-123",
    });
    vi.advanceTimersByTime(31 * 60 * 1000);

    expect(events.list()).toEqual([]);
    vi.useRealTimers();
  });
});
