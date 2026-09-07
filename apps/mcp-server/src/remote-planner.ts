import { request } from "undici";
import { z } from "zod";

import {
  type AgentPlan,
  type AgentPlanningStatus,
  type ConversationTurn,
  agentPlanSchema,
  type MessagePlanner,
} from "./agent.js";

interface RemotePlannerConfig {
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

const planningJsonSchema = {
  type: "object",
  oneOf: [
    {
      properties: {
        intent: { const: "order_status" },
        order_id: { type: "string", pattern: "^ORD-[0-9]{4,12}$" },
      },
      required: ["intent", "order_id"],
      additionalProperties: false,
    },
    {
      properties: {
        intent: { const: "failed_payment_summary" },
        date: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
      },
      required: ["intent"],
      additionalProperties: false,
    },
    {
      properties: {
        intent: { const: "recent_orders" },
        limit: { type: "integer", minimum: 1, maximum: 5 },
      },
      required: ["intent"],
      additionalProperties: false,
    },
    {
      properties: {
        intent: { const: "failed_payment_trend" },
        days: { type: "integer", minimum: 1, maximum: 7 },
      },
      required: ["intent"],
      additionalProperties: false,
    },
    {
      properties: {
        intent: { const: "sensitive_payment_data" },
        customer_id: { type: "string", pattern: "^CUS-[0-9]{4,12}$" },
      },
      required: ["intent", "customer_id"],
      additionalProperties: false,
    },
    {
      properties: { intent: { const: "explain_last_decision" } },
      required: ["intent"],
      additionalProperties: false,
    },
    {
      properties: {
        intent: { const: "explain_lab" },
        topic: {
          enum: ["nhi", "verify", "vault", "mcp", "security_flow"],
        },
      },
      required: ["intent", "topic"],
      additionalProperties: false,
    },
    {
      properties: {
        intent: { const: "casual_chat" },
        topic: { enum: ["greeting", "thanks", "identity"] },
      },
      required: ["intent", "topic"],
      additionalProperties: false,
    },
    {
      properties: { intent: { const: "unsupported" } },
      required: ["intent"],
      additionalProperties: false,
    },
  ],
} as const;

const systemMessage = [
  "You are a strict intent router for a Korean security lab.",
  "Return exactly one JSON object matching the supplied schema.",
  "Never answer the user and never add identifiers that are absent from the input.",
  "Map questions about JWT, OBO, subject_token, token exchange, or RFC 8693 to explain_lab/security_flow.",
  "Map questions about IBM Verify login or user authentication to explain_lab/verify.",
  "Map standalone greetings, thanks, and identity questions to casual_chat.",
  "Use the recent conversation only to resolve follow-up references.",
  "Use unsupported when the request does not match a listed intent.",
].join(" ");

export class RemoteMessagePlanner implements MessagePlanner {
  #ready = false;

  public constructor(private readonly config: RemotePlannerConfig) {}

  public async plan(
    message: string,
    context: readonly ConversationTurn[] = [],
  ): Promise<AgentPlan> {
    const boundedMessage = message.trim().slice(0, 500);
    const boundedContext = context.slice(-4).map((turn) => ({
      role: turn.role,
      content: turn.content.trim().slice(0, 1_000),
    }));
    const endpoint = new URL(
      "api/chat",
      ensureTrailingSlash(this.config.baseUrl),
    );
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
          ...boundedContext,
          { role: "user", content: boundedMessage },
        ],
        stream: false,
        think: false,
        format: planningJsonSchema,
        options: { temperature: 0, num_predict: 160 },
        keep_alive: this.config.keepAlive,
      }),
      headersTimeout: this.config.timeoutMs,
      bodyTimeout: this.config.timeoutMs,
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      await response.body.dump();
      this.#ready = false;
      throw new Error(
        `Agent planning service returned status ${String(response.statusCode)}`,
      );
    }

    const body = responseSchema.parse(await response.body.json());
    const plan = agentPlanSchema.parse(
      JSON.parse(stripCodeFence(body.message.content)) as unknown,
    );
    validateSourceGrounding(
      plan,
      [...boundedContext.map((turn) => turn.content), boundedMessage].join(
        "\n",
      ),
    );
    this.#ready = true;
    return plan;
  }

  public async prewarm(): Promise<void> {
    await this.plan("이 Lab의 보안 흐름을 설명해줘");
  }

  public status(): AgentPlanningStatus {
    return {
      configured: true,
      ready: this.#ready,
      mode: this.#ready ? "enhanced" : "safe-fallback",
      fallbackReady: true,
    };
  }
}

function validateSourceGrounding(plan: AgentPlan, message: string): void {
  const upperMessage = message.toUpperCase();
  if (
    plan.intent === "order_status" &&
    !upperMessage.includes(plan.order_id.toUpperCase())
  ) {
    throw new Error("Agent planning service returned an ungrounded order ID");
  }
  if (
    plan.intent === "sensitive_payment_data" &&
    !upperMessage.includes(plan.customer_id.toUpperCase())
  ) {
    throw new Error(
      "Agent planning service returned an ungrounded customer ID",
    );
  }
  if (
    plan.intent === "failed_payment_summary" &&
    plan.date &&
    !message.includes(plan.date)
  ) {
    throw new Error("Agent planning service returned an ungrounded date");
  }
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced?.[1] ?? trimmed;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
