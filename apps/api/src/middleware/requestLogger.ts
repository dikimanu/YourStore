import { pinoHttp } from "pino-http";
import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { logger } from "../lib/logger.js";
import { env } from "../env.js";

export const requestLogger = pinoHttp({
  logger,
  enabled: env.NODE_ENV !== "test",
  genReqId: (req) => (req.headers["x-request-id"] as string) || crypto.randomUUID(),
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) =>
    `${req.method ?? "UNKNOWN"} ${req.url ?? ""} -> ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method ?? "UNKNOWN"} ${req.url ?? ""} -> ${res.statusCode} (${err.message})`,
  serializers: {
    req: (req: IncomingMessage) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res: ServerResponse) => ({
      statusCode: res.statusCode,
    }),
  },
  autoLogging: {
    ignore: (req) => req.url === "/health",
  },
});
