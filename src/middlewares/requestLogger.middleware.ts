/**
 * HTTP request logging middleware.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { pinoHttp } from "pino-http";
import { logger } from "../infrastructure/logger/logger.js";

const HEALTH_PATHS = new Set(["/health", "/ready"]);

export const requestLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req: IncomingMessage) => HEALTH_PATHS.has(req.url ?? ""),
  },
  customSuccessMessage(req: IncomingMessage, res: ServerResponse) {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage(
    req: IncomingMessage,
    res: ServerResponse,
    err: Error,
  ) {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  },
});
