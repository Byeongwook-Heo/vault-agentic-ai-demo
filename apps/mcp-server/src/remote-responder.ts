import { request } from "undici";
import { z } from "zod";

import type { AnswerComposer, AnswerComposerInput } from "./agent.js";

interface RemoteResponderConfig {
  baseUrl: string;
  model: string;
  apiToken: string;
  timeoutMs: number;
  keepAlive: string;
}

const responseSchema = z.object({
  message: z.object({
    content: z.string().min(2).max(16_384),
  }),
});

const systemMessage = [
  "당신은 기업 보안 데모의 한국어 AI 에이전트입니다.",
  "현재 질문에는 제공된 검증 사실만 사용해 자연스럽고 간결하게 답하세요.",
  "최근 대화는 대명사와 후속 질문의 맥락을 이해하는 용도로만 사용하세요.",
  "주문 ID, 상태, 건수, 허용·거부 결정은 검증 사실과 정확히 일치해야 합니다.",
  "등록되지 않은 도구 실행, 임의 SQL 실행, 추가 데이터 조회를 주장하지 마세요.",
  "토큰 원문, 비밀번호, 비밀키, 자격증명, 내부 모델 또는 런타임 이름을 절대 출력하지 마세요.",
  "마크다운 표나 코드 블록 없이 2~5개의 읽기 쉬운 문장으로 답하세요.",
].join(" ");

export class RemoteAnswerComposer implements AnswerComposer {
  public constructor(private readonly config: RemoteResponderConfig) {}

  public async compose(input: AnswerComposerInput): Promise<string> {
    const endpoint = new URL(
      "api/chat",
      ensureTrailingSlash(this.config.baseUrl),
    );
    const recentContext = input.context.slice(-4).map((turn) => ({
      role: turn.role,
      content: turn.content.trim().slice(0, 1_000),
    }));
    const response = await request(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: "system", content: systemMessage },
          ...recentContext,
          {
            role: "user",
            content: JSON.stringify({
              current_question: input.message.trim().slice(0, 500),
              classified_intent: input.intent,
              verified_facts: input.groundedReply.trim().slice(0, 4_000),
            }),
          },
        ],
        stream: false,
        think: false,
        options: { temperature: 0.25, num_predict: 420 },
        keep_alive: this.config.keepAlive,
      }),
      headersTimeout: this.config.timeoutMs,
      bodyTimeout: this.config.timeoutMs,
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      await response.body.dump();
      throw new Error(
        `Agent response service returned status ${String(response.statusCode)}`,
      );
    }

    const body = responseSchema.parse(await response.body.json());
    return validateGroundedAnswer(body.message.content, input.groundedReply);
  }
}

function validateGroundedAnswer(value: string, groundedReply: string): string {
  const answer = value.trim();
  if (answer.length < 2 || answer.length > 2_000) {
    throw new Error("Agent response is outside the allowed length");
  }
  if (
    /(?:eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|client[_ -]?secret|root[_ -]?token|BEGIN (?:RSA |EC )?PRIVATE KEY|\bollama\b|\bqwen\b)/i.test(
      answer,
    )
  ) {
    throw new Error(
      "Agent response contains prohibited runtime or secret data",
    );
  }

  const requiredIdentifiers = new Set(
    groundedReply.match(/\b(?:ORD|CUS)-[0-9]{4,12}\b/gi) ?? [],
  );
  for (const identifier of requiredIdentifiers) {
    if (!answer.toUpperCase().includes(identifier.toUpperCase())) {
      throw new Error("Agent response omitted a grounded identifier");
    }
  }

  const requiredLiteralFacts = new Set(
    groundedReply.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d+(?:건|일|초)\b/gu) ?? [],
  );
  for (const fact of requiredLiteralFacts) {
    if (!answer.includes(fact)) {
      throw new Error("Agent response altered or omitted a grounded fact");
    }
  }
  const semanticFacts: [RegExp, RegExp][] = [
    [
      /배송 준비 중/u,
      /배송(?:을|이|은|는| 상태는)?\s*준비(?:하고 있| 중| 단계)/u,
    ],
    [/배송 중/u, /배송(?:이|은|는| 상태는)?\s*(?:진행|중)/u],
    [/배송 완료/u, /배송(?:이|은|는| 상태는)?\s*완료/u],
    [/결제 완료/u, /결제(?:가|는|은| 상태는)?\s*(?:정상적으로\s*)?완료/u],
    [/결제 실패/u, /결제(?:가|는|은| 상태는)?\s*실패/u],
    [/결제 대기/u, /결제(?:가|는|은| 상태는)?\s*대기/u],
    [/취소/u, /취소/u],
    [/보류/u, /보류/u],
  ];
  for (const [groundedPattern, answerPattern] of semanticFacts) {
    if (groundedPattern.test(groundedReply) && !answerPattern.test(answer)) {
      throw new Error("Agent response altered or omitted a grounded status");
    }
  }

  const groundedDenial =
    /차단|거부|권한(?:이|이\s)?\s*없|찾을 수 없|승인된 사용자만/.test(
      groundedReply,
    );
  if (
    groundedDenial &&
    !/차단|거부|권한(?:이|이\s)?\s*없|찾을 수 없|조회할 수 없|허용되지 않/.test(
      answer,
    )
  ) {
    throw new Error("Agent response omitted the grounded denial decision");
  }

  return answer;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
