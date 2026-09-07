import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";

import { accessTierLabel } from "./access-control.js";
import { AppError, ExternalServiceError } from "./errors.js";
import type { GatewayTokenProvider } from "./contextforge-client.js";
import type { IdentityProvider } from "./identity-client.js";
import type { EventStage, EventStatus } from "./types.js";
import type { UserPrincipal } from "./user-auth.js";

export interface UnapprovedChatPrincipal {
  subject: string;
  displayName: string;
  authorization: "unapproved";
}

export type ChatPrincipal = UserPrincipal | UnapprovedChatPrincipal;

const accessSchema = z.object({
  nhi: z.string(),
  user_subject: z.string().optional(),
  verify: z.literal("authenticated"),
  vault: z.literal("authorized"),
  credential_type: z.literal("dynamic"),
  credential_ttl_seconds: z.number().int().positive(),
  access_tier: z.enum(["orders-full", "orders-limited"]).optional(),
});
const orderDataSchema = z.object({
  order_id: z.string(),
  payment_status: z.string(),
  delivery_status: z.string(),
  updated_at: z.string(),
});
const orderResultSchema = z.discriminatedUnion("status", [
  orderDataSchema.extend({ status: z.literal("found"), access: accessSchema }),
  z.object({
    status: z.literal("not_found_or_unauthorized"),
    access: accessSchema,
  }),
]);
const paymentSummarySchema = z.object({
  date: z.string(),
  failed_count: z.number(),
  by_delivery_status: z.array(
    z.object({ delivery_status: z.string(), count: z.number() }),
  ),
  access: accessSchema,
});
const recentOrdersSchema = z.object({
  orders: z.array(orderDataSchema).max(5),
  access: accessSchema,
});
const failedPaymentTrendSchema = z.object({
  days: z.number().int().min(1).max(7),
  points: z
    .array(
      z.object({
        date: z.string(),
        total_count: z.number().int().nonnegative(),
        failed_count: z.number().int().nonnegative(),
      }),
    )
    .max(7),
  access: accessSchema,
});
const denialSchema = z.object({
  status: z.literal("denied"),
  authentication: z.literal("successful"),
  authorization: z.literal("denied"),
  reason: z.string(),
});

const orderIdSchema = z.string().regex(/^ORD-[0-9]{4,12}$/);
const customerIdSchema = z.string().regex(/^CUS-[0-9]{4,12}$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const agentPlanSchema = z.discriminatedUnion("intent", [
  z
    .object({ intent: z.literal("order_status"), order_id: orderIdSchema })
    .strict(),
  z
    .object({
      intent: z.literal("failed_payment_summary"),
      date: dateSchema.optional(),
    })
    .strict(),
  z
    .object({
      intent: z.literal("recent_orders"),
      limit: z.number().int().min(1).max(5).optional(),
    })
    .strict(),
  z
    .object({
      intent: z.literal("failed_payment_trend"),
      days: z.number().int().min(1).max(7).optional(),
    })
    .strict(),
  z
    .object({
      intent: z.literal("sensitive_payment_data"),
      customer_id: customerIdSchema,
    })
    .strict(),
  z.object({ intent: z.literal("explain_last_decision") }).strict(),
  z
    .object({
      intent: z.literal("explain_lab"),
      topic: z.enum(["nhi", "verify", "vault", "mcp", "security_flow"]),
    })
    .strict(),
  z
    .object({
      intent: z.literal("casual_chat"),
      topic: z.enum(["greeting", "thanks", "identity"]),
    })
    .strict(),
  z.object({ intent: z.literal("unsupported") }).strict(),
]);

export type AgentPlan = z.infer<typeof agentPlanSchema>;
export type AgentToolName =
  | "get_order_status"
  | "get_failed_payment_summary"
  | "get_recent_orders"
  | "get_failed_payment_trend"
  | "get_sensitive_payment_data";

function planUsesMcp(plan: AgentPlan): boolean {
  return [
    "order_status",
    "failed_payment_summary",
    "recent_orders",
    "failed_payment_trend",
    "sensitive_payment_data",
  ].includes(plan.intent);
}

export interface AgentTraceStep {
  label: string;
  detail: string;
  status: "verified" | "allowed" | "issued" | "denied";
}

export interface AgentSuggestion {
  label: string;
  prompt: string;
}

export interface AgentReply {
  reply: string;
  tool: AgentToolName | null;
  trace: AgentTraceStep[];
  suggestions?: AgentSuggestion[];
  credential?: {
    initialTtlSeconds: number;
    state: "released";
  };
}

export interface AgentPlanningStatus {
  configured: boolean;
  ready: boolean;
  mode: "enhanced" | "safe-fallback";
  fallbackReady: true;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AnswerComposerInput {
  message: string;
  groundedReply: string;
  intent: AgentPlan["intent"];
  context: readonly ConversationTurn[];
}

export interface AnswerComposer {
  compose(input: AnswerComposerInput): Promise<string>;
}

export interface McpToolCaller {
  callTool(
    tool: AgentToolName,
    argumentsValue: Record<string, string | number>,
    accessToken: string,
    requestId?: string,
  ): Promise<Record<string, unknown>>;
}

export interface MessagePlanner {
  plan(
    message: string,
    context?: readonly ConversationTurn[],
  ): Promise<AgentPlan>;
  prewarm?(): Promise<void>;
  status?(): AgentPlanningStatus;
}

export interface ChatAgent {
  respond(
    message: string,
    principal: ChatPrincipal,
    requestId?: string,
  ): Promise<AgentReply>;
  preflight?(): Promise<AgentPlanningStatus>;
  getStatus?(): AgentPlanningStatus;
  reset?(subject: string): void;
}

export type AgentProgressReporter = (event: {
  stage: EventStage;
  status: EventStatus;
  action: string;
  requestId: string;
}) => void;

export class HttpMcpToolCaller implements McpToolCaller {
  public constructor(
    private readonly endpoint: string,
    private readonly serviceVersion: string,
    private readonly gatewayTokenProvider?: GatewayTokenProvider,
  ) {}

  public async callTool(
    tool: AgentToolName,
    argumentsValue: Record<string, string | number>,
    accessToken: string,
    requestId?: string,
  ): Promise<Record<string, unknown>> {
    const gatewayAccessToken = this.gatewayTokenProvider
      ? await this.gatewayTokenProvider.getAccessToken()
      : undefined;
    const client = new Client(
      {
        name: "agentic-security-chatbot",
        version: this.serviceVersion,
      },
      { capabilities: {} },
    );
    const transport = new StreamableHTTPClientTransport(
      new URL(this.endpoint),
      {
        requestInit: {
          headers: {
            authorization: `Bearer ${gatewayAccessToken ?? accessToken}`,
            ...(gatewayAccessToken
              ? { "x-upstream-authorization": `Bearer ${accessToken}` }
              : {}),
            ...(gatewayAccessToken && requestId
              ? { "x-upstream-request-id": requestId }
              : {}),
            ...(requestId ? { "x-request-id": requestId } : {}),
          },
        },
      },
    );
    try {
      await client.connect(
        transport as unknown as Parameters<Client["connect"]>[0],
      );
      const catalog = await client.listTools();
      const publishedToolName = resolvePublishedToolName(
        tool,
        catalog.tools.map((candidate) => candidate.name),
      );
      if (!publishedToolName) {
        throw new AppError(
          "The selected MCP tool is not published",
          502,
          "MCP_TOOL_UNAVAILABLE",
        );
      }
      const result = await client.callTool({
        name: publishedToolName,
        arguments: argumentsValue,
        ...(requestId
          ? {
              _meta: {
                "com.ibm.agentic-security-lab/request-id": requestId,
              },
            }
          : {}),
      });
      if (result.isError || !result.structuredContent) {
        throw new ExternalServiceError("MCP", extractMcpError(result.content));
      }
      return result.structuredContent as Record<string, unknown>;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new ExternalServiceError("MCP", "tool call failed", {
        cause: error,
      });
    } finally {
      await client.close().catch(() => undefined);
    }
  }
}

export function resolvePublishedToolName(
  tool: AgentToolName,
  publishedNames: readonly string[],
): string | undefined {
  if (publishedNames.includes(tool)) return tool;

  // ContextForge namespaces gateway-discovered tools as
  // "{gateway-slug}-{slugified-original-name}". The virtual server is already
  // restricted to this lab's five associated tools, so require exactly one
  // suffix match before invoking a namespaced entry.
  const slug = tool.replaceAll("_", "-");
  const matches = publishedNames.filter((name) => name.endsWith(`-${slug}`));
  return matches.length === 1 ? matches[0] : undefined;
}

export class RuleBasedPlanner implements MessagePlanner {
  public plan(
    message: string,
    context: readonly ConversationTurn[] = [],
  ): Promise<AgentPlan> {
    const direct = this.#planSingle(message);
    if (
      direct.intent !== "unsupported" ||
      context.length === 0 ||
      !shouldUseConversationContext(message)
    ) {
      return Promise.resolve(direct);
    }
    const recentContext = context
      .slice(-2)
      .map((turn) => `${turn.role}: ${turn.content}`)
      .join("\n");
    return Promise.resolve(
      this.#planSingle(`${recentContext}\nuser: ${message}`),
    );
  }

  #planSingle(message: string): AgentPlan {
    const normalized = message.trim();

    const casualTopic = casualChatTopic(normalized);
    if (casualTopic) {
      return { intent: "casual_chat", topic: casualTopic };
    }

    if (
      /(왜|이유|설명).*(차단|거부|허용|권한|요청)|(차단|거부|허용).*(왜|이유|설명)|임시.*(권한|자격증명)|직전.*(결정|요청)/i.test(
        normalized,
      )
    ) {
      return { intent: "explain_last_decision" };
    }

    const sensitiveCustomer = /\bCUS-[0-9]{4,12}\b/i.exec(normalized);
    if (
      sensitiveCustomer &&
      /(민감|카드|원문|개인|payment data|sensitive)/i.test(normalized)
    ) {
      return {
        intent: "sensitive_payment_data",
        customer_id: sensitiveCustomer[0].toUpperCase(),
      };
    }

    if (/(최근|최신).*(주문)|(주문).*(최근|최신)/i.test(normalized)) {
      return {
        intent: "recent_orders",
        limit: boundedNumber(normalized, 5, 1, 5),
      };
    }

    if (
      /(실패|failed).*(결제|payment).*(추이|통계|날짜별)|(추이|통계|날짜별).*(실패|failed).*(결제|payment)/i.test(
        normalized,
      )
    ) {
      return {
        intent: "failed_payment_trend",
        days: boundedNumber(normalized, 7, 1, 7),
      };
    }

    const order = /\bORD-[0-9]{4,12}\b/i.exec(normalized);
    if (order) {
      return {
        intent: "order_status",
        order_id: order[0].toUpperCase(),
      };
    }

    if (
      /(실패|실패한|failed).*(결제|payment)|(결제|payment).*(실패|failed)/i.test(
        normalized,
      )
    ) {
      const date = /\b\d{4}-\d{2}-\d{2}\b/.exec(normalized)?.[0];
      return {
        intent: "failed_payment_summary",
        ...(date ? { date } : {}),
      };
    }

    const topic = labTopic(normalized);
    if (topic) {
      return { intent: "explain_lab", topic };
    }

    return { intent: "unsupported" };
  }
}

export class ResilientPlanner implements MessagePlanner {
  #lastMode: AgentPlanningStatus["mode"] = "safe-fallback";
  #retryAfter = 0;

  public constructor(
    private readonly primary: MessagePlanner,
    private readonly fallback: MessagePlanner,
    private readonly onFallback?: (error: unknown) => void,
    private readonly retryDelayMs = 30_000,
  ) {}

  public async plan(
    message: string,
    context: readonly ConversationTurn[] = [],
  ): Promise<AgentPlan> {
    const relevantContext = shouldUseConversationContext(message)
      ? context
      : [];
    const deterministicPlan = await this.fallback.plan(message, []);
    if (deterministicPlan.intent !== "unsupported") {
      return deterministicPlan;
    }
    if (Date.now() < this.#retryAfter) {
      return this.fallback.plan(message, relevantContext);
    }
    try {
      const primaryPlan = await this.primary.plan(message, relevantContext);
      this.#lastMode = "enhanced";
      this.#retryAfter = 0;
      if (primaryPlan.intent !== "unsupported") {
        return primaryPlan;
      }
      const fallbackPlan = await this.fallback.plan(message, relevantContext);
      return fallbackPlan.intent === "unsupported" ? primaryPlan : fallbackPlan;
    } catch (error) {
      this.#lastMode = "safe-fallback";
      this.#retryAfter = Date.now() + this.retryDelayMs;
      this.onFallback?.(error);
      return this.fallback.plan(message, relevantContext);
    }
  }

  public async prewarm(): Promise<void> {
    if (!this.primary.prewarm) {
      this.#lastMode = "safe-fallback";
      return;
    }
    try {
      await this.primary.prewarm();
      this.#lastMode = "enhanced";
      this.#retryAfter = 0;
    } catch (error) {
      this.#lastMode = "safe-fallback";
      this.#retryAfter = Date.now() + this.retryDelayMs;
      this.onFallback?.(error);
    }
  }

  public status(): AgentPlanningStatus {
    const primaryStatus = this.primary.status?.();
    return {
      configured: primaryStatus?.configured ?? true,
      ready: this.#lastMode === "enhanced" && (primaryStatus?.ready ?? true),
      mode: this.#lastMode,
      fallbackReady: true,
    };
  }
}

interface RememberedDecision {
  at: number;
  reply: AgentReply;
}

interface RememberedConversation {
  at: number;
  turns: ConversationTurn[];
}

const decisionRetentionMs = 15 * 60 * 1000;
const maximumRememberedUsers = 100;
const maximumConversationTurns = 6;

export class BoundedChatAgent implements ChatAgent {
  readonly #lastDecisions = new Map<string, RememberedDecision>();
  readonly #conversations = new Map<string, RememberedConversation>();

  public constructor(
    private readonly mcp: McpToolCaller,
    private readonly planner: MessagePlanner = new RuleBasedPlanner(),
    private readonly reportProgress?: AgentProgressReporter,
    private readonly delegatedIdentity?: IdentityProvider,
    private readonly answerComposer?: AnswerComposer,
  ) {}

  public async respond(
    message: string,
    principal: ChatPrincipal,
    requestId?: string,
  ): Promise<AgentReply> {
    const normalized = message.trim();
    if (!normalized) {
      throw new AppError("Message is required", 400, "INVALID_CHAT_MESSAGE");
    }

    const rememberConversation = "accessToken" in principal;
    const context = rememberConversation
      ? this.#conversationContext(principal.subject)
      : [];
    const relevantContext = shouldUseConversationContext(normalized)
      ? context
      : [];
    let plan: AgentPlan;
    try {
      plan = agentPlanSchema.parse(
        await this.planner.plan(normalized, relevantContext),
      );
    } catch (error) {
      if (requestId) {
        this.reportProgress?.({
          stage: "policy",
          status: "error",
          action: "agent_plan_failed",
          requestId,
        });
      }
      throw error;
    }
    if (planUsesMcp(plan) && !isApprovedPrincipal(principal)) {
      if (requestId) {
        this.reportProgress?.({
          stage: "policy",
          status: "denied",
          action: "protected_data_requires_verify",
          requestId,
        });
      }
      const draft = unapprovedDataReply(plan, principal);
      const reply = await this.#composeReply(
        normalized,
        plan,
        draft,
        relevantContext,
      );
      this.#remember(principal.subject, reply);
      if (rememberConversation) {
        this.#rememberConversation(principal.subject, normalized, reply.reply);
      }
      return reply;
    }
    if (requestId) {
      this.reportProgress?.({
        stage: "policy",
        status: "allowed",
        action: planUsesMcp(plan)
          ? `agent_plan_${plan.intent}`
          : `agent_response_${plan.intent}`,
        requestId,
      });
    }
    const draft = isApprovedPrincipal(principal)
      ? await this.#execute(plan, principal, requestId)
      : this.#executeUnapproved(plan, principal);
    const reply = await this.#composeReply(
      normalized,
      plan,
      draft,
      relevantContext,
    );
    if (reply.tool) {
      this.#remember(principal.subject, reply);
    }
    if (rememberConversation) {
      this.#rememberConversation(principal.subject, normalized, reply.reply);
    }
    return reply;
  }

  public async preflight(): Promise<AgentPlanningStatus> {
    await this.planner.prewarm?.();
    return this.getStatus();
  }

  public getStatus(): AgentPlanningStatus {
    return (
      this.planner.status?.() ?? {
        configured: false,
        ready: false,
        mode: "safe-fallback",
        fallbackReady: true,
      }
    );
  }

  public reset(subject: string): void {
    this.#lastDecisions.delete(subject);
    this.#conversations.delete(subject);
  }

  async #composeReply(
    message: string,
    plan: AgentPlan,
    draft: AgentReply,
    context: readonly ConversationTurn[],
  ): Promise<AgentReply> {
    if (!this.answerComposer || plan.intent === "unsupported") {
      return draft;
    }
    try {
      const reply = await this.answerComposer.compose({
        message,
        groundedReply: draft.reply,
        intent: plan.intent,
        context,
      });
      return { ...draft, reply };
    } catch {
      return draft;
    }
  }

  #executeUnapproved(plan: AgentPlan, principal: ChatPrincipal): AgentReply {
    switch (plan.intent) {
      case "explain_last_decision":
        return this.#explainLastDecision(principal);
      case "explain_lab":
        return explainLab(plan.topic, principal);
      case "casual_chat":
        return casualChat(plan.topic, principal);
      case "unsupported":
        return unsupportedReply(principal);
      default:
        return unapprovedDataReply(plan, principal);
    }
  }

  async #execute(
    plan: AgentPlan,
    principal: UserPrincipal,
    requestId?: string,
  ): Promise<AgentReply> {
    const delegatedAccessToken = planUsesMcp(plan)
      ? await this.#exchangeDelegatedToken(principal, requestId)
      : principal.accessToken;
    switch (plan.intent) {
      case "sensitive_payment_data": {
        const result = denialSchema.parse(
          await this.#callTool(
            "get_sensitive_payment_data",
            { customer_id: plan.customer_id },
            delegatedAccessToken,
            requestId,
          ),
        );
        void result.reason;
        return {
          reply:
            `요청은 차단되었습니다. 사용자 인증은 성공했지만 Agent의 Vault 정책에는 ` +
            `${plan.customer_id}의 민감 결제 정보 권한이 없습니다. 데이터베이스 조회는 실행되지 않았습니다.`,
          tool: "get_sensitive_payment_data",
          trace: deniedTrace(principal),
          suggestions: decisionSuggestions(true),
        };
      }
      case "order_status": {
        const result = orderResultSchema.parse(
          await this.#callTool(
            "get_order_status",
            { order_id: plan.order_id },
            delegatedAccessToken,
            requestId,
          ),
        );
        if (result.status === "not_found_or_unauthorized") {
          return restrictedOrderReply(
            `주문 ${plan.order_id}에 대한 정보를 찾을 수 없거나 접근 권한이 없습니다.`,
            principal,
            result.access.credential_ttl_seconds,
            [
              { label: "최근 주문 5건", prompt: "최근 주문 5건을 요약해줘" },
              ...decisionSuggestions(false),
            ],
          );
        }
        return allowedReply(
          `주문 ${result.order_id}은 현재 ${translateDeliveryStatus(
            result.delivery_status,
          )} 상태이며, 결제 상태는 ${translatePaymentStatus(
            result.payment_status,
          )}입니다.`,
          "get_order_status",
          principal,
          result.access.credential_ttl_seconds,
          [
            { label: "최근 주문 5건", prompt: "최근 주문 5건을 요약해줘" },
            ...decisionSuggestions(false),
          ],
        );
      }
      case "failed_payment_summary": {
        const date = plan.date ?? todayInSeoul();
        const result = paymentSummarySchema.parse(
          await this.#callTool(
            "get_failed_payment_summary",
            { date },
            delegatedAccessToken,
            requestId,
          ),
        );
        return allowedReply(
          `${accessScopeLabel(principal)} ${result.date} 실패 결제는 ${String(result.failed_count)}건입니다.` +
            formatDeliveryBreakdown(result.by_delivery_status),
          "get_failed_payment_summary",
          principal,
          result.access.credential_ttl_seconds,
          [
            {
              label: "7일 실패 결제 통계",
              prompt: "최근 7일 실패 결제 통계를 보여줘",
            },
            ...decisionSuggestions(false),
          ],
        );
      }
      case "recent_orders": {
        const limit = plan.limit ?? 5;
        const result = recentOrdersSchema.parse(
          await this.#callTool(
            "get_recent_orders",
            { limit },
            delegatedAccessToken,
            requestId,
          ),
        );
        const orderSummary = result.orders.length
          ? result.orders
              .map(
                (order) =>
                  `${order.order_id} ${translateDeliveryStatus(order.delivery_status)}·${translatePaymentStatus(order.payment_status)}`,
              )
              .join(", ")
          : "조회된 주문이 없습니다";
        return allowedReply(
          `${accessScopeLabel(principal)} 최근 주문 ${String(result.orders.length)}건을 확인했습니다. ${orderSummary}.`,
          "get_recent_orders",
          principal,
          result.access.credential_ttl_seconds,
          [
            {
              label: "실패 결제 통계",
              prompt: "최근 7일 실패 결제 통계를 보여줘",
            },
            ...decisionSuggestions(false),
          ],
        );
      }
      case "failed_payment_trend": {
        const days = plan.days ?? 7;
        const result = failedPaymentTrendSchema.parse(
          await this.#callTool(
            "get_failed_payment_trend",
            { days },
            delegatedAccessToken,
            requestId,
          ),
        );
        const trend = result.points.length
          ? result.points
              .map(
                (point) =>
                  `${point.date} ${String(point.failed_count)}건/${String(point.total_count)}건`,
              )
              .join(", ")
          : "해당 기간에 주문 데이터가 없습니다";
        return allowedReply(
          `${accessScopeLabel(principal)} 최근 ${String(result.days)}일 실패 결제 통계입니다. ${trend}.`,
          "get_failed_payment_trend",
          principal,
          result.access.credential_ttl_seconds,
          [
            { label: "오늘 실패 결제", prompt: "오늘 실패한 결제를 요약해줘" },
            ...decisionSuggestions(false),
          ],
        );
      }
      case "explain_last_decision":
        return this.#explainLastDecision(principal);
      case "explain_lab":
        return explainLab(plan.topic, principal);
      case "casual_chat":
        return casualChat(plan.topic, principal);
      case "unsupported":
        return unsupportedReply(principal);
    }
  }

  async #callTool(
    tool: AgentToolName,
    argumentsValue: Record<string, string | number>,
    accessToken: string,
    requestId?: string,
  ): Promise<Record<string, unknown>> {
    try {
      if (requestId) {
        this.reportProgress?.({
          stage: "gateway",
          status: "allowed",
          action: "contextforge_obo_forwarded",
          requestId,
        });
      }
      const result = requestId
        ? await this.mcp.callTool(tool, argumentsValue, accessToken, requestId)
        : await this.mcp.callTool(tool, argumentsValue, accessToken);
      return result;
    } catch (error) {
      if (requestId) {
        this.reportProgress?.({
          stage: "gateway",
          status: "error",
          action: "contextforge_request_failed",
          requestId,
        });
      }
      throw error;
    }
  }

  async #exchangeDelegatedToken(
    principal: UserPrincipal,
    requestId?: string,
  ): Promise<string> {
    if (!this.delegatedIdentity) return principal.accessToken;
    try {
      const token = await this.delegatedIdentity.getVerifiedAccessToken({
        subject: principal.subject,
        subjectToken: principal.accessToken,
        ...(principal.accessTier ? { accessTier: principal.accessTier } : {}),
        ...(principal.assertedAccessTier
          ? { assertedAccessTier: principal.assertedAccessTier }
          : {}),
      });
      if (requestId) {
        this.reportProgress?.({
          stage: "identity",
          status: "allowed",
          action: "verify_obo_token_exchanged",
          requestId,
        });
      }
      return token;
    } catch (error) {
      if (requestId) {
        this.reportProgress?.({
          stage: "identity",
          status: "error",
          action: "verify_obo_exchange_failed",
          requestId,
        });
      }
      throw error;
    }
  }

  #explainLastDecision(principal: ChatPrincipal): AgentReply {
    const remembered = this.#lastDecisions.get(principal.subject);
    if (!remembered || Date.now() - remembered.at > decisionRetentionMs) {
      this.#lastDecisions.delete(principal.subject);
      return {
        reply:
          "아직 설명할 접근 결정이 없습니다. 주문 조회나 정책 차단 요청을 먼저 실행해 주세요.",
        tool: null,
        trace: policyOnlyTrace(principal),
        suggestions: defaultSuggestions(),
      };
    }

    const previous = remembered.reply;
    const denied = previous.trace.some((step) => step.status === "denied");
    const tool = previous.tool ? toolDisplayName(previous.tool) : "직전 요청";
    const credential = previous.credential;
    return {
      reply: denied
        ? `직전 ${tool} 요청은 IBM Verify 인증과 OBO 신원 검증까지 성공했지만 Vault 최소 권한 정책에서 차단되었습니다. 민감 데이터 조회와 DB 자격증명 발급은 수행되지 않았습니다.`
        : `직전 ${tool} 요청은 IBM Verify 사용자와 Agent OBO 신원을 검증한 뒤 Vault의 읽기 전용 역할로 허용되었습니다. ${credential ? `자격증명의 최초 TTL 상한은 ${String(credential.initialTtlSeconds)}초였고 요청 종료와 함께 사용이 끝났습니다.` : "추가 자격증명은 사용하지 않았습니다."}`,
      tool: null,
      trace: previous.trace,
      ...(credential ? { credential } : {}),
      suggestions: defaultSuggestions(),
    };
  }

  #remember(subject: string, reply: AgentReply): void {
    const now = Date.now();
    for (const [key, value] of this.#lastDecisions) {
      if (now - value.at > decisionRetentionMs) {
        this.#lastDecisions.delete(key);
      }
    }
    if (
      this.#lastDecisions.size >= maximumRememberedUsers &&
      !this.#lastDecisions.has(subject)
    ) {
      const oldest = this.#lastDecisions.keys().next().value;
      if (oldest) this.#lastDecisions.delete(oldest);
    }
    this.#lastDecisions.delete(subject);
    this.#lastDecisions.set(subject, { at: now, reply });
  }

  #conversationContext(subject: string): readonly ConversationTurn[] {
    const remembered = this.#conversations.get(subject);
    if (!remembered || Date.now() - remembered.at > decisionRetentionMs) {
      this.#conversations.delete(subject);
      return [];
    }
    return remembered.turns;
  }

  #rememberConversation(subject: string, message: string, reply: string): void {
    const now = Date.now();
    for (const [key, value] of this.#conversations) {
      if (now - value.at > decisionRetentionMs) {
        this.#conversations.delete(key);
      }
    }
    if (
      this.#conversations.size >= maximumRememberedUsers &&
      !this.#conversations.has(subject)
    ) {
      const oldest = this.#conversations.keys().next().value;
      if (oldest) this.#conversations.delete(oldest);
    }
    const previous = this.#conversations.get(subject)?.turns ?? [];
    const turns: ConversationTurn[] = [
      ...previous,
      { role: "user", content: message.slice(0, 500) },
      { role: "assistant", content: reply.slice(0, 1_500) },
    ].slice(-maximumConversationTurns) as ConversationTurn[];
    this.#conversations.delete(subject);
    this.#conversations.set(subject, { at: now, turns });
  }
}

function allowedReply(
  reply: string,
  tool: Exclude<AgentToolName, "get_sensitive_payment_data">,
  principal: UserPrincipal,
  ttlSeconds: number,
  suggestions: AgentSuggestion[],
): AgentReply {
  return {
    reply,
    tool,
    trace: allowedTrace(principal, ttlSeconds),
    credential: { initialTtlSeconds: ttlSeconds, state: "released" },
    suggestions,
  };
}

function restrictedOrderReply(
  reply: string,
  principal: UserPrincipal,
  ttlSeconds: number,
  suggestions: AgentSuggestion[],
): AgentReply {
  return {
    reply,
    tool: "get_order_status",
    trace: [
      ...allowedTrace(principal, ttlSeconds),
      {
        label: "PostgreSQL 데이터 범위",
        detail:
          "요청한 주문이 없거나 현재 사용자 권한 범위에서 보이지 않아 데이터를 반환하지 않음",
        status: "denied",
      },
    ],
    credential: { initialTtlSeconds: ttlSeconds, state: "released" },
    suggestions,
  };
}

function allowedTrace(
  principal: UserPrincipal,
  ttlSeconds: number,
): AgentTraceStep[] {
  return [
    {
      label: "사용자 JWT",
      detail: `${safeIdentityLabel(principal)} · Verify 검증 완료 · ${accessTierLabel(principal.accessTier ?? "orders-full")}`,
      status: "verified",
    },
    {
      label: "OBO JWT",
      detail: "Verify Token Endpoint · RFC 8693 교환 완료",
      status: "verified",
    },
    {
      label: "ContextForge Gateway",
      detail: "허용된 MCP 도구 라우팅 · OBO JWT 전달",
      status: "allowed",
    },
    {
      label: "MCP Server",
      detail: "OBO JWT 및 고정 도구 스키마 검증",
      status: "verified",
    },
    {
      label: "Vault 정책",
      detail: `${principal.accessTier === "orders-limited" ? "bob-orders-limited" : "bob-orders-full"} 역할 허용`,
      status: "allowed",
    },
    {
      label: "동적 DB 자격증명",
      detail: `최초 TTL ${String(ttlSeconds)}초 · 요청 종료 시 사용 종료`,
      status: "issued",
    },
  ];
}

function deniedTrace(principal: UserPrincipal): AgentTraceStep[] {
  return [
    {
      label: "사용자 JWT",
      detail: `${safeIdentityLabel(principal)} · Verify 검증 완료`,
      status: "verified",
    },
    {
      label: "OBO JWT",
      detail: "Verify Token Endpoint · RFC 8693 교환 완료",
      status: "verified",
    },
    {
      label: "ContextForge Gateway",
      detail: "허용된 MCP 도구 라우팅 · OBO JWT 전달",
      status: "allowed",
    },
    {
      label: "MCP Server",
      detail: "OBO JWT 및 민감 정보 도구 요청 검증",
      status: "verified",
    },
    {
      label: "Vault 정책",
      detail: "민감 결제 정보 역할은 현재 Agent 정책에서 허용되지 않음",
      status: "denied",
    },
  ];
}

function policyOnlyTrace(principal: ChatPrincipal): AgentTraceStep[] {
  return [
    {
      label: isApprovedPrincipal(principal)
        ? "IBM Verify 사용자"
        : "챗봇 사용자",
      detail: isApprovedPrincipal(principal)
        ? safeIdentityLabel(principal)
        : `${safeIdentityLabel(principal)} · Verify 미인증`,
      status: isApprovedPrincipal(principal) ? "verified" : "allowed",
    },
    {
      label: "Agent 정책",
      detail: "허용된 안내와 MCP 도구 범위만 응답",
      status: "allowed",
    },
  ];
}

function explainLab(
  topic: Extract<AgentPlan, { intent: "explain_lab" }>["topic"],
  principal: ChatPrincipal,
): AgentReply {
  const replies = {
    nhi: "NHI는 사람이 아닌 애플리케이션과 Agent가 사용하는 신원입니다. 이 Lab에서는 Agent 신원과 로그인한 사용자의 subject를 결합해 요청 주체를 증명합니다.",
    verify:
      "IBM Verify는 사용자를 로그인시키고 사용자 Access Token을 발급합니다. 이후 Agent는 Verify Token Endpoint에 사용자 토큰을 subject_token으로 제출하고 KMS 서명 신원을 결합해 MCP용 OBO JWT로 교환합니다.",
    vault:
      "Vault는 OBO JWT의 issuer, audience, Agent claim을 검증하고 허용된 역할에만 짧은 TTL의 읽기 전용 DB 자격증명을 발급합니다.",
    mcp: "ContextForge는 Agent 요청을 등록된 MCP 도구로만 라우팅하고 OBO JWT를 전달합니다. MCP Server는 토큰과 입력 스키마를 다시 검증하므로 임의 SQL이나 등록되지 않은 도구는 실행할 수 없습니다.",
    security_flow:
      "이 Lab의 흐름은 IBM Verify 사용자 인증 → Agent 계획 → Verify Token Endpoint의 RFC 8693 OBO 교환 → ContextForge Gateway → MCP 도구 검증 → Vault 정책 평가 → 짧은 TTL의 PostgreSQL 접근 순서입니다.",
  } as const;
  return {
    reply: replies[topic],
    tool: null,
    trace: policyOnlyTrace(principal),
    suggestions: defaultSuggestions(),
  };
}

function casualChat(
  topic: Extract<AgentPlan, { intent: "casual_chat" }>["topic"],
  principal: ChatPrincipal,
): AgentReply {
  const replies = {
    greeting:
      "안녕하세요. 주문 조회나 이 Lab의 인증·권한 흐름에 관해 도와드릴 수 있습니다. 무엇이 궁금하신가요?",
    thanks:
      "천만에요. 다른 주문 조회나 보안 흐름이 궁금하면 이어서 말씀해 주세요.",
    identity:
      "저는 Bob AI 에이전트입니다. 등록된 읽기 전용 MCP 도구와 현재 사용자의 권한 범위 안에서 주문을 조회하고, 이 Lab의 인증·권한 흐름을 설명합니다.",
  } as const;
  return {
    reply: replies[topic],
    tool: null,
    trace: policyOnlyTrace(principal),
    suggestions: defaultSuggestions(),
  };
}

function unsupportedReply(principal: ChatPrincipal): AgentReply {
  return {
    reply:
      "이 Lab에서는 주문 상태, 최근 주문, 실패 결제 요약·통계, 접근 결정 설명과 보안 구성 안내를 처리합니다. 모든 데이터 요청은 등록된 읽기 전용 MCP 도구로 제한됩니다.",
    tool: null,
    trace: policyOnlyTrace(principal),
    suggestions: defaultSuggestions(),
  };
}

function defaultSuggestions(): AgentSuggestion[] {
  return [
    { label: "주문 상태 확인", prompt: "ORD-1001 배송 상태가 어떻게 돼?" },
    { label: "최근 주문 요약", prompt: "최근 주문 5건을 요약해줘" },
    { label: "보안 흐름 안내", prompt: "이 Lab의 보안 흐름을 설명해줘" },
  ];
}

function decisionSuggestions(denied: boolean): AgentSuggestion[] {
  return [
    {
      label: denied ? "차단 이유 설명" : "접근 결정 설명",
      prompt: denied
        ? "왜 방금 요청이 차단됐어?"
        : "방금 접근이 왜 허용됐는지 설명해줘",
    },
  ];
}

function toolDisplayName(tool: AgentToolName): string {
  const labels: Record<AgentToolName, string> = {
    get_order_status: "주문 상태 조회",
    get_failed_payment_summary: "실패 결제 요약",
    get_recent_orders: "최근 주문 조회",
    get_failed_payment_trend: "실패 결제 통계",
    get_sensitive_payment_data: "민감 정보 접근",
  };
  return labels[tool];
}

function labTopic(
  message: string,
): Extract<AgentPlan, { intent: "explain_lab" }>["topic"] | undefined {
  if (/\bNHI\b|비인간|비-인간|머신 신원/i.test(message)) return "nhi";
  if (/IBM Verify|Verify 역할|사용자 인증/i.test(message)) return "verify";
  if (
    /\bOBO\b|토큰\s*교환|Token\s*Exchange|subject_token|사용자\s*(?:JWT|Access Token)|RFC\s*8693/i.test(
      message,
    )
  ) {
    return "security_flow";
  }
  if (/Vault.*(역할|필요|설명)|왜.*Vault/i.test(message)) return "vault";
  if (
    /(?:\bMCP\b|ContextForge|Gateway).*(역할|필요|설명)|(?:MCP|ContextForge|Gateway)(?:는|가)/i.test(
      message,
    )
  ) {
    return "mcp";
  }
  if (/보안 흐름|인증 흐름|신원 경로|Lab.*(구성|흐름)/i.test(message)) {
    return "security_flow";
  }
  return undefined;
}

function casualChatTopic(
  message: string,
): Extract<AgentPlan, { intent: "casual_chat" }>["topic"] | undefined {
  if (/^(?:안녕(?:하세요)?|반가워(?:요)?|hello|hi)[?!.~\s]*$/iu.test(message)) {
    return "greeting";
  }
  if (
    /^(?:고마워(?:요)?|감사(?:해요|합니다)?|thanks?|thank you)[?!.~\s]*$/iu.test(
      message,
    )
  ) {
    return "thanks";
  }
  if (
    /^(?:너는\s*누구(?:야|니)?|누구(?:야|세요)?|자기소개(?:해줘)?|뭐\s*하는\s*(?:챗봇|에이전트)(?:이야)?)[?!.~\s]*$/u.test(
      message,
    )
  ) {
    return "identity";
  }
  return undefined;
}

function shouldUseConversationContext(message: string): boolean {
  return /(?:^|\s)(?:그|이|저)\s*(?:주문|요청|과정|단계|결과|접근|결정|내용)|(?:아까|방금|직전|이전|다시|한\s*번\s*더|그거|그것|그때|거기서|이어서)|(?:위|해당)\s*(?:내용|결과|주문|요청|과정)/iu.test(
    message.trim(),
  );
}

function boundedNumber(
  message: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const candidate = /\b([0-9]{1,2})\b/.exec(message)?.[1];
  if (!candidate) return defaultValue;
  return Math.min(maximum, Math.max(minimum, Number(candidate)));
}

function safeIdentityLabel(principal: ChatPrincipal): string {
  return principal.displayName.slice(0, 80);
}

function accessScopeLabel(principal: UserPrincipal): string {
  return principal.accessTier === "orders-limited"
    ? "제한된 주문 범위에서"
    : "전체 주문 범위에서";
}

function isApprovedPrincipal(
  principal: ChatPrincipal,
): principal is UserPrincipal {
  return (
    "accessToken" in principal &&
    principal.accessToken.length > 0 &&
    principal.accessTier !== "unapproved"
  );
}

function unapprovedDataReply(
  plan: AgentPlan,
  principal: ChatPrincipal,
): AgentReply {
  const tool = toolForPlan(plan);
  return {
    reply:
      "챗봇 안내는 누구나 이용할 수 있지만 주문·결제 데이터 조회는 승인된 사용자만 가능합니다. " +
      `${"accessToken" in principal ? "현재 Verify 사용자에게 필요한 주문 조회 권한이 없습니다." : "IBM Verify로 로그인한 뒤 다시 요청해 주세요."} ` +
      "이번 요청은 Agent 권한 검사에서 중단되어 MCP, Vault, PostgreSQL을 호출하지 않았습니다.",
    tool,
    trace: [
      {
        label: "챗봇 이용",
        detail: `${safeIdentityLabel(principal)} · 일반 안내 사용 가능`,
        status: "allowed",
      },
      {
        label: "보호 데이터 권한",
        detail:
          "accessToken" in principal
            ? "Verify 인증 성공 · 보호 데이터 권한 미부여"
            : "IBM Verify 사용자 세션 없음 · 조회 권한 미부여",
        status: "denied",
      },
    ],
    suggestions: [
      { label: "Lab 보안 흐름", prompt: "이 Lab의 보안 흐름을 설명해줘" },
      { label: "NHI 설명", prompt: "NHI가 무엇인지 설명해줘" },
    ],
  };
}

function toolForPlan(plan: AgentPlan): AgentToolName | null {
  switch (plan.intent) {
    case "order_status":
      return "get_order_status";
    case "failed_payment_summary":
      return "get_failed_payment_summary";
    case "recent_orders":
      return "get_recent_orders";
    case "failed_payment_trend":
      return "get_failed_payment_trend";
    case "sensitive_payment_data":
      return "get_sensitive_payment_data";
    default:
      return null;
  }
}

function todayInSeoul(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDeliveryBreakdown(
  values: { delivery_status: string; count: number }[],
): string {
  if (values.length === 0) {
    return "";
  }
  return ` 배송 상태별로는 ${values
    .map(
      (entry) =>
        `${translateDeliveryStatus(entry.delivery_status)} ${String(entry.count)}건`,
    )
    .join(", ")}입니다.`;
}

function translateDeliveryStatus(value: string): string {
  const labels: Record<string, string> = {
    PREPARING: "배송 준비 중",
    SHIPPED: "배송 중",
    DELIVERED: "배송 완료",
    CANCELLED: "취소",
    ON_HOLD: "보류",
  };
  return labels[value] ?? value;
}

function translatePaymentStatus(value: string): string {
  const labels: Record<string, string> = {
    PAID: "결제 완료",
    FAILED: "결제 실패",
    PENDING: "결제 대기",
    REFUNDED: "환불 완료",
  };
  return labels[value] ?? value;
}

function extractMcpError(content: unknown): string {
  const parsedContent = z
    .array(
      z
        .object({
          type: z.string(),
          text: z.string().optional(),
        })
        .loose(),
    )
    .safeParse(content);
  if (!parsedContent.success) {
    return "tool returned an error";
  }
  const text = parsedContent.data.find(
    (item) => item.type === "text" && item.text,
  )?.text;
  if (!text) {
    return "tool returned an error";
  }
  try {
    const parsed = z
      .object({ message: z.string().min(1) })
      .loose()
      .parse(JSON.parse(text));
    return parsed.message;
  } catch {
    return "tool returned an error";
  }
}
