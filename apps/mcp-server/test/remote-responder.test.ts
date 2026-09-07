import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { RemoteAnswerComposer } from "../src/remote-responder.js";

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

describe("RemoteAnswerComposer", () => {
  it("turns verified facts into a natural answer without receiving secrets", async () => {
    let requestBody = "";
    const composer = await createComposer((request, response) => {
      request.setEncoding("utf8");
      request.on("data", (chunk) => (requestBody += String(chunk)));
      request.on("end", () => {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            message: {
              content:
                "주문 ORD-1001은 현재 배송을 준비하고 있으며 결제는 정상적으로 완료됐습니다. 요청은 승인된 읽기 전용 경로에서 처리됐습니다.",
            },
          }),
        );
      });
    });

    const answer = await composer.compose({
      message: "그 주문 지금 어떻게 됐어?",
      groundedReply:
        "주문 ORD-1001은 현재 배송 준비 중 상태이며, 결제 상태는 결제 완료입니다.",
      intent: "order_status",
      context: [
        { role: "user", content: "ORD-1001을 확인해줘" },
        { role: "assistant", content: "주문을 조회했습니다." },
      ],
    });

    expect(answer).toContain("ORD-1001");
    expect(requestBody).toContain("verified_facts");
    expect(requestBody).toContain("그 주문 지금 어떻게 됐어?");
    expect(requestBody).not.toContain("header.payload.signature");
    expect(requestBody).not.toContain("dynamic-password");
  });

  it("rejects an answer that drops a grounded denial decision", async () => {
    const composer = await createComposer((_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          message: {
            content: "주문 ORD-1002의 배송 상태를 확인했습니다.",
          },
        }),
      );
    });

    await expect(
      composer.compose({
        message: "ORD-1002 상태 알려줘",
        groundedReply:
          "주문 ORD-1002에 대한 정보를 찾을 수 없거나 접근 권한이 없습니다.",
        intent: "order_status",
        context: [],
      }),
    ).rejects.toThrow(/denial decision/);
  });

  it("rejects an answer that exposes the private runtime name", async () => {
    const composer = await createComposer((_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          message: {
            content: "Ollama가 이 답변을 생성했습니다.",
          },
        }),
      );
    });

    await expect(
      composer.compose({
        message: "누가 답변해?",
        groundedReply: "Bob AI 에이전트가 검증된 안내를 제공합니다.",
        intent: "explain_lab",
        context: [],
      }),
    ).rejects.toThrow(/prohibited runtime/);
  });
});

async function createComposer(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<RemoteAnswerComposer> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return new RemoteAnswerComposer({
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    model: "private-test-model",
    apiToken: "runtime-token-for-tests",
    timeoutMs: 2_000,
    keepAlive: "1m",
  });
}
