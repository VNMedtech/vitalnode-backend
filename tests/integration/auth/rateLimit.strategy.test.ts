import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  buildAuthRateLimitKey,
  createRateLimiter,
} from "../../../src/middlewares/rateLimit.middleware.js";

function createRateLimitedTestApp() {
  const app = express();
  app.use(express.json());

  const authLimiter = createRateLimiter(1, {
    limiterName: "auth",
    keyGenerator: buildAuthRateLimitKey,
  });
  const globalLimiter = createRateLimiter(1, {
    limiterName: "global",
  });

  app.post("/auth/login", authLimiter, (_req, res) => {
    // Mimic failed login attempts without hitting DB.
    res.status(401).json({ ok: false, message: "Invalid credentials" });
  });

  app.post("/products/search", globalLimiter, (req, res) => {
    res.status(200).json({ ok: true, email: req.body.email });
  });

  return app;
}

describe("Auth rate-limit strategy", () => {
  it("isolates different identifiers behind the same IP", async () => {
    const app = createRateLimitedTestApp();

    const first = await request(app)
      .post("/auth/login")
      .send({ email: "first@example.com", password: "x" });
    const second = await request(app)
      .post("/auth/login")
      .send({ email: "second@example.com", password: "x" });

    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
  });

  it("keeps fallback to IP-only when identifier is missing", async () => {
    const app = createRateLimitedTestApp();

    const first = await request(app).post("/auth/login").send({ password: "x" });
    const second = await request(app).post("/auth/login").send({ password: "x" });

    expect(first.status).toBe(401);
    expect(second.status).toBe(429);
  });

  it("keeps global limiter keyed by IP for non-auth routes", async () => {
    const app = createRateLimitedTestApp();

    const first = await request(app)
      .post("/products/search")
      .send({ email: "first@example.com" });
    const second = await request(app)
      .post("/products/search")
      .send({ email: "second@example.com" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });
});
