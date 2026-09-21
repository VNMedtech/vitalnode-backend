/**
 * HTTP request logging middleware.
 * Logs a single line per request so polling does not flood the terminal.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { pinoHttp } from "pino-http";
import { logger } from "../infrastructure/logger/logger.js";

const HEALTH_PATHS = new Set(["/health", "/ready"]);

function requestPath(req: IncomingMessage): string {
  const expressReq = req as IncomingMessage & { originalUrl?: string };
  return expressReq.originalUrl ?? req.url ?? "";
}

export const requestLogger = pinoHttp({
  logger,
  wrapSerializers: false,
  quietReqLogger: true,
  autoLogging: {
    ignore: (req: IncomingMessage) => {
      const path = requestPath(req).split("?")[0] ?? "";
      return HEALTH_PATHS.has(path);
    },
  },
  serializers: {
    req: (req: IncomingMessage) => ({
      method: req.method,
      url: requestPath(req),
    }),
    res: (res: ServerResponse) => ({
      statusCode: res.statusCode,
    }),
  },
  customSuccessObject: (_req, _res, val: { responseTime?: number }) => ({
    responseTime: val.responseTime,
  }),
  customSuccessMessage(req, res, responseTime) {
    return `${req.method} ${requestPath(req)} ${res.statusCode} ${responseTime}ms`;
  },
  customErrorMessage(req, res, err) {
    return `${req.method} ${requestPath(req)} ${res.statusCode} - ${err.message}`;
  },
  customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) {
      return "error";
    }
    if (res.statusCode >= 400) {
      return "warn";
    }
    return "info";
  },
});
