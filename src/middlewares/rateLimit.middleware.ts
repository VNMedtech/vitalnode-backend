/**
 * Rate limiting middleware — protects API endpoints against abuse.
 */
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { errorResponse } from "../shared/responses/api.response.js";

function createRateLimiter(max: number) {
  return rateLimit({
    windowMs: env.rateLimitWindowMs,
    max,
    skip: () => env.nodeEnv === "development",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res
        .status(429)
        .json(
          errorResponse("Too many requests, please try again later"),
        );
    },
  });
}

/** Default API rate limiter for general routes. */
export const rateLimiter = createRateLimiter(env.rateLimitMax);

/** Stricter rate limiter for authentication routes. */
export const authRateLimiter = createRateLimiter(env.authRateLimitMax);
