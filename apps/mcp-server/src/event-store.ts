import { randomUUID } from "node:crypto";

import type { EventStage, EventStatus, SecurityEvent } from "./types.js";

const maximumEvents = 100;
const retentionMilliseconds = 30 * 60 * 1000;
const safeActionPattern = /[^A-Za-z0-9 .:_/-]/g;

export class SecurityEventStore {
  readonly #events: SecurityEvent[] = [];

  public record(input: {
    stage: EventStage;
    status: EventStatus;
    action: string;
    requestId: string;
    latencyMs?: number;
  }): SecurityEvent {
    this.#removeExpired();
    const event: SecurityEvent = {
      id: randomUUID(),
      at: new Date().toISOString(),
      stage: input.stage,
      status: input.status,
      action: input.action.replace(safeActionPattern, "").slice(0, 96),
      requestId: input.requestId.slice(0, 64),
      ...(input.latencyMs === undefined
        ? {}
        : { latencyMs: Math.max(0, Math.round(input.latencyMs)) }),
    };
    this.#events.unshift(event);
    this.#events.splice(maximumEvents);
    return event;
  }

  public list(limit = 30): SecurityEvent[] {
    this.#removeExpired();
    return this.#events.slice(0, Math.min(Math.max(limit, 1), maximumEvents));
  }

  public clear(): void {
    this.#events.splice(0);
  }

  #removeExpired(): void {
    const cutoff = Date.now() - retentionMilliseconds;
    let oldest = this.#events.at(-1);
    while (oldest && Date.parse(oldest.at) < cutoff) {
      this.#events.pop();
      oldest = this.#events.at(-1);
    }
  }
}
