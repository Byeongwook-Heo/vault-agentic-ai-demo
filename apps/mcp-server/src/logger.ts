import pino, { type Logger } from "pino";

import type { AppConfig } from "./config.js";

const redactionPaths = [
  "req.headers.authorization",
  "headers.authorization",
  "req.headers.cookie",
  "headers.cookie",
  "cookie",
  "authorization",
  "access_token",
  "accessToken",
  "id_token",
  "subject_token",
  "subjectToken",
  "session",
  "client_assertion",
  "clientAssertion",
  "jwt",
  "token",
  "client_token",
  "clientToken",
  "password",
  "credentials.password",
  "username",
  "credentials.username",
];

export function createLogger(config: AppConfig): Logger {
  return pino({
    level: config.logLevel,
    base: {
      service: "bob-vault-nhi-demo",
      version: config.serviceVersion,
    },
    redact: {
      paths: redactionPaths,
      censor: "[REDACTED]",
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
  });
}
