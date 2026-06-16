/**
 * Centralized application logger built on Pino.
 * Redacts sensitive fields and uses pretty output in development.
 */
import pino from "pino";
import { env } from "../../config/env.js";

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "password",
  "passwordHash",
  "token",
  "refreshToken",
  "accessToken",
  "jwt",
  "authorization",
  "razorpayPaymentId",
  "razorpaySignature",
];

export const logger = pino({
  level: env.logLevel,
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
  ...(env.nodeEnv === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
});
