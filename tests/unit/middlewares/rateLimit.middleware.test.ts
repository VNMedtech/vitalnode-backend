import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  buildAuthRateLimitKey,
  createRateLimiter,
  extractAuthRateLimitIdentifier,
} from "../../../src/middlewares/rateLimit.middleware.js";

describe("rate limit middleware helpers", () => {
  it("uses ip::normalized-email key when email is present", () => {
    const req = {
      ip: "::1",
      body: { email: "  USER@Example.COM  " },
    } as const;

    expect(extractAuthRateLimitIdentifier(req as never)).toBe("user@example.com");
    expect(buildAuthRateLimitKey(req as never)).toBe("::1::user@example.com");
  });

  it("falls back to ip-only key when identifier is missing", () => {
    const req = {
      ip: "::1",
      body: { password: "secret" },
    } as const;

    expect(extractAuthRateLimitIdentifier(req as never)).toBeUndefined();
    expect(buildAuthRateLimitKey(req as never)).toBe("::1");
  });
});

describe("createRateLimiter", () => {
  it("returns the same 429 response shape while honoring custom key generator", async () => {
    const app = express();
    const limiter = createRateLimiter(1, {
      limiterName: "unit-test",
      keyGenerator: () => "shared-key",
    });

    app.use(express.json());
    app.post("/limited", limiter, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const first = await request(app).post("/limited").send({});
    const second = await request(app).post("/limited").send({});

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.body).toEqual({
      success: false,
      message: "Too many requests, please try again later",
      errors: [],
    });
  });
});
