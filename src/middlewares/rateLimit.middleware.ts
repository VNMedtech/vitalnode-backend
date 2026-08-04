/**
 * Rate limiting middleware — protects API endpoints against abuse.
 */
import rateLimit from "express-rate-limit";
import type { Request } from "express";
import { env } from "../config/env.js";
import { logger } from "../infrastructure/logger/logger.js";
import { errorResponse } from "../shared/responses/api.response.js";

type RateLimitKeyGenerator = (req: Request) => string;

interface CreateRateLimiterOptions {
  keyGenerator?: RateLimitKeyGenerator;
  limiterName?: string;
}

const AUTH_IDENTIFIER_FIELDS = [
  "email",
  "identifier",
  "username",
  "userEmail",
] as const;

function normalizeIdentifier(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function getIdentifierFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const payload = body as Record<string, unknown>;

  for (const field of AUTH_IDENTIFIER_FIELDS) {
    const normalized = normalizeIdentifier(payload[field]);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function hashIdentifier(identifier: string): string {
  let hash = 0;
  for (let index = 0; index < identifier.length; index += 1) {
    hash = (hash * 31 + identifier.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function extractIdentifierFromKey(key: string): string | undefined {
  const separatorIndex = key.indexOf("::");
  if (separatorIndex <= 0) {
    return undefined;
  }

  return key.slice(separatorIndex + 2) || undefined;
}

function getRouteLabel(req: Request): string {
  return req.route?.path?.toString() ?? req.path;
}

export function extractAuthRateLimitIdentifier(req: Request): string | undefined {
  return getIdentifierFromBody(req.body);
}

export function buildAuthRateLimitKey(req: Request): string {
  const identifier = extractAuthRateLimitIdentifier(req);
  return identifier ? `${req.ip}::${identifier}` : req.ip;
}

export function createRateLimiter(
  max: number,
  options: CreateRateLimiterOptions = {},
) {
  const limiterName = options.limiterName ?? "global";
  const keyGenerator: RateLimitKeyGenerator =
    options.keyGenerator ?? ((req) => req.ip);

  return rateLimit({
    windowMs: env.rateLimitWindowMs,
    max,
    skip: () => env.nodeEnv === "development",
    keyGenerator: (req) => keyGenerator(req),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const key = keyGenerator(req);
      const identifier = extractIdentifierFromKey(key);

      logger.warn(
        {
          limiter: limiterName,
          route: getRouteLabel(req),
          ip: req.ip,
          identifierHash: identifier ? hashIdentifier(identifier) : undefined,
          decision: "blocked",
        },
        "Rate limit triggered",
      );

      res
        .status(429)
        .json(
          errorResponse("Too many requests, please try again later"),
        );
    },
  });
}

/** Default API rate limiter for general routes. */
export const rateLimiter = createRateLimiter(env.rateLimitMax, {
  limiterName: "global",
});

/** Stricter rate limiter for authentication routes. */
export const authRateLimiter = createRateLimiter(env.authRateLimitMax, {
  keyGenerator: buildAuthRateLimitKey,
  limiterName: "auth",
});
