import { createServer } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { RemoteMessagePlanner } from "../src/remote-planner.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
});

describe("RemoteMessagePlanner", () => {
  it("sends only the bounded message and accepts a schema-validated plan", async () => {
    let requestBody = "";
    let authorization = "";
    const server = createServer((request, response) => {
      authorization = request.headers.authorization ?? "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => (requestBody += String(chunk)));
      request.on("end", () => {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            message: {
              content: JSON.stringify({
                intent: "order_status",
                order_id: "ORD-1001",
              }),
            },
          }),
        );
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    const planner = new RemoteMessagePlanner({
      baseUrl: `http://127.0.0.1:${String(address.port)}`,
      model: "private-test-model",
      apiToken: "runtime-token-for-tests",
      timeoutMs: 2_000,
      keepAlive: "1m",
    });

    const plan = await planner.plan("ORD-1001 배송 상태 알려줘");

    expect(plan).toEqual({ intent: "order_status", order_id: "ORD-1001" });
    expect(authorization).toBe("Bearer runtime-token-for-tests");
    expect(requestBody).toContain("ORD-1001 배송 상태 알려줘");
    expect(JSON.parse(requestBody)).toMatchObject({
      stream: false,
      think: false,
    });
    expect(requestBody).not.toContain("header.payload.signature.user");
    expect(requestBody).not.toContain("dynamic-password");
  });

  it("rejects identifiers that were not present in the user message", async () => {
    const server = createServer((_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              intent: "order_status",
              order_id: "ORD-9999",
            }),
          },
        }),
      );
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    const planner = new RemoteMessagePlanner({
      baseUrl: `http://127.0.0.1:${String(address.port)}`,
      model: "private-test-model",
      apiToken: "runtime-token-for-tests",
      timeoutMs: 2_000,
      keepAlive: "1m",
    });

    await expect(planner.plan("ORD-1001 상태 알려줘")).rejects.toThrow(
      /ungrounded order ID/,
    );
  });
});
