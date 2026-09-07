import { createServer } from "node:http";

import type { Logger } from "pino";

import {
  BoundedChatAgent,
  HttpMcpToolCaller,
  ResilientPlanner,
  RuleBasedPlanner,
} from "./agent.js";
import { loadConfig } from "./config.js";
import { ContextForgeClient } from "./contextforge-client.js";
import { PostgresOrdersDatabase } from "./database.js";
import { SecurityEventStore } from "./event-store.js";
import { createHttpApp } from "./http-app.js";
import {
  type IdentityProvider,
  type OboTokenVerifier,
  PreverifiedIdentityClient,
  UnconfiguredIdentityClient,
  VerifyIdentityClient,
  VerifyOboIdentityClient,
  VerifyOboTokenVerifier,
} from "./identity-client.js";
import { KmsClientAssertionSigner } from "./kms-signer.js";
import { createLogger } from "./logger.js";
import { RemoteMessagePlanner } from "./remote-planner.js";
import { RemoteAnswerComposer } from "./remote-responder.js";
import { ToolService } from "./tool-service.js";
import {
  UnconfiguredUserAuth,
  type UserAuthenticator,
  VerifyUserAuth,
} from "./user-auth.js";
import { VaultClient } from "./vault-client.js";

const config = loadConfig();
const logger = createLogger(config);
const events = new SecurityEventStore();
const signer = createSigner();
const delegatedIdentity = createIdentity(signer);
const toolIdentity =
  config.identityFlow === "obo"
    ? new PreverifiedIdentityClient()
    : delegatedIdentity;
const oboVerifier = createOboVerifier();
const gateway = createGateway();
const userAuth = createUserAuth();
const vault = new VaultClient(config.vault);
const database = new PostgresOrdersDatabase(config.database);
const tools = new ToolService(
  toolIdentity,
  vault,
  database,
  events,
  "chat-agent",
);
const agent = config.chatbotEnabled ? createAgent() : undefined;
const app = createHttpApp({
  config,
  logger,
  events,
  tools,
  userAuth,
  ...(agent ? { agent } : {}),
  ...(signer ? { signer } : {}),
  ...(oboVerifier ? { oboVerifier } : {}),
  ...(gateway ? { gateway } : {}),
});
const httpServer = createServer(app);

httpServer.listen(config.port, "0.0.0.0", () => {
  logger.info(
    {
      port: config.port,
      mode: config.appMode,
      protocol: "2025-11-25",
    },
    "secure agent service is ready",
  );
  if (gateway) {
    void gateway
      .initialize()
      .then(() => logger.info("ContextForge gateway registration completed"))
      .catch((error: unknown) => {
        logger.error(
          { err: error },
          "ContextForge gateway registration failed; readiness remains closed",
        );
      });
  }
  if (agent) {
    void agent.preflight().then((status) => {
      logger.info(
        { ready: status.ready, mode: status.mode },
        "agent planning preflight completed",
      );
    });
  }
});

function createAgent(): BoundedChatAgent {
  const fallback = new RuleBasedPlanner();
  const planning = config.agentPlanning;
  const privateRuntime =
    planning.mode === "private" &&
    planning.baseUrl &&
    planning.model &&
    planning.apiToken
      ? {
          baseUrl: planning.baseUrl,
          model: planning.model,
          apiToken: planning.apiToken,
          timeoutMs: planning.timeoutMs,
          keepAlive: planning.keepAlive,
        }
      : undefined;
  const planner = privateRuntime
    ? new ResilientPlanner(
        new RemoteMessagePlanner(privateRuntime),
        fallback,
        (error) => {
          logger.warn(
            { err: error },
            "agent planning service unavailable; safe routing is active",
          );
        },
      )
    : fallback;
  const answerComposer = privateRuntime
    ? new RemoteAnswerComposer(privateRuntime)
    : undefined;
  return new BoundedChatAgent(
    new HttpMcpToolCaller(
      config.mcpInternalUrl,
      config.serviceVersion,
      gateway,
    ),
    planner,
    (event) => events.record(event),
    delegatedIdentity,
    answerComposer,
  );
}

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();
  httpServer.closeIdleConnections();
  httpServer.closeAllConnections();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await vault.close();
  clearTimeout(forceExit);
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "uncaught exception");
  void shutdown("uncaughtException");
});
process.on("unhandledRejection", (error) => {
  logger.fatal({ err: error }, "unhandled rejection");
  void shutdown("unhandledRejection");
});

function createSigner(): KmsClientAssertionSigner | undefined {
  const verify = config.verify;
  if (!verify.kmsKeyId) {
    return undefined;
  }
  const clientId =
    config.identityFlow === "obo" ? verify.obo.clientId : verify.clientId;
  const audience =
    config.identityFlow === "obo" ? verify.obo.tokenUrl : verify.tokenUrl;
  return new KmsClientAssertionSigner({
    region: config.awsRegion,
    keyId: verify.kmsKeyId,
    ...(clientId ? { clientId } : {}),
    ...(audience ? { audience } : {}),
  });
}

function createIdentity(
  availableSigner: KmsClientAssertionSigner | undefined,
): IdentityProvider {
  const verify = config.verify;
  if (config.identityFlow === "obo") {
    const obo = verify.obo;
    if (
      !availableSigner ||
      !obo.tokenUrl ||
      !obo.jwksUrl ||
      !obo.issuer ||
      !obo.audience ||
      !obo.clientId ||
      !obo.actorValue
    ) {
      return new UnconfiguredIdentityClient();
    }
    return new VerifyOboIdentityClient(
      {
        tokenUrl: obo.tokenUrl,
        jwksUrl: obo.jwksUrl,
        issuer: obo.issuer,
        audience: obo.audience,
        clientId: obo.clientId,
        ...(obo.scope ? { scope: obo.scope } : {}),
        actorClaim: obo.actorClaim,
        actorValue: obo.actorValue,
        accessControl: config.accessControl,
      },
      availableSigner,
    );
  }
  if (
    !availableSigner ||
    !verify.tokenUrl ||
    !verify.jwksUrl ||
    !verify.issuer ||
    !verify.audience ||
    !verify.clientId ||
    !verify.nhiValue
  ) {
    return new UnconfiguredIdentityClient();
  }
  return new VerifyIdentityClient(
    {
      tokenUrl: verify.tokenUrl,
      jwksUrl: verify.jwksUrl,
      issuer: verify.issuer,
      audience: verify.audience,
      clientId: verify.clientId,
      ...(verify.scope ? { scope: verify.scope } : {}),
      nhiClaim: verify.nhiClaim,
      nhiValue: verify.nhiValue,
    },
    availableSigner,
  );
}

function createUserAuth(): UserAuthenticator {
  const user = config.verify.user;
  if (
    !config.chatbotEnabled ||
    !config.sessionSecret ||
    !config.publicBaseUrl ||
    !user.authorizationUrl ||
    !user.tokenUrl ||
    !user.jwksUrl ||
    !user.issuer ||
    !user.clientId
  ) {
    return new UnconfiguredUserAuth();
  }
  return new VerifyUserAuth({
    authorizationUrl: user.authorizationUrl,
    tokenUrl: user.tokenUrl,
    jwksUrl: user.jwksUrl,
    issuer: user.issuer,
    ...(user.audience ? { audience: user.audience } : {}),
    clientId: user.clientId,
    ...(user.clientSecret ? { clientSecret: user.clientSecret } : {}),
    scopes: user.scopes,
    redirectUri: `${config.publicBaseUrl}/auth/callback`,
    sessionSecret: config.sessionSecret,
    accessControl: config.accessControl,
  });
}

function createOboVerifier(): OboTokenVerifier | undefined {
  if (config.mcpAuthMode !== "obo_jwt") return undefined;
  const obo = config.verify.obo;
  if (!obo.jwksUrl || !obo.issuer || !obo.audience || !obo.actorValue) {
    return undefined;
  }
  return new VerifyOboTokenVerifier({
    jwksUrl: obo.jwksUrl,
    issuer: obo.issuer,
    audience: obo.audience,
    actorClaim: obo.actorClaim,
    actorValue: obo.actorValue,
    accessControl: config.accessControl,
  });
}

function createGateway(): ContextForgeClient | undefined {
  const gatewayConfig = config.contextForge;
  if (!gatewayConfig.enabled) return undefined;
  if (
    !gatewayConfig.baseUrl ||
    !gatewayConfig.serverId ||
    !gatewayConfig.adminEmail ||
    !gatewayConfig.adminPassword ||
    !gatewayConfig.upstreamUrl
  ) {
    return undefined;
  }
  return new ContextForgeClient({
    baseUrl: gatewayConfig.baseUrl,
    serverId: gatewayConfig.serverId,
    adminEmail: gatewayConfig.adminEmail,
    adminPassword: gatewayConfig.adminPassword,
    upstreamUrl: gatewayConfig.upstreamUrl,
    upstreamDiscoveryToken: config.transportBearerToken,
  });
}

function logStartupError(error: unknown, startupLogger: Logger): never {
  startupLogger.fatal({ err: error }, "service startup failed");
  process.exit(1);
}

process.on("beforeExit", (code) => {
  if (code !== 0) {
    logStartupError(
      new Error(`process exited with code ${String(code)}`),
      logger,
    );
  }
});
