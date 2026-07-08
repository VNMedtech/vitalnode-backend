import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("dotenv", () => ({
  config: vi.fn(),
}));

const BASE_ENV = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  JWT_SECRET: "change-me-min-32-characters-long!!",
  JWT_REFRESH_SECRET: "change-me-min-32-characters-long!!",
  CORS_ORIGIN: "https://buyer.example.com",
} as const;

describe("Swagger in production", () => {
  const savedNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = BASE_ENV.DATABASE_URL;
    process.env.JWT_SECRET = BASE_ENV.JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = BASE_ENV.JWT_REFRESH_SECRET;
    process.env.CORS_ORIGIN = BASE_ENV.CORS_ORIGIN;
  });

  afterEach(() => {
    vi.resetModules();

    if (savedNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = savedNodeEnv;
    }
  });

  it("does not expose /api-docs when NODE_ENV is production", async () => {
    const { app } = await import("../../../src/app.js");

    const res = await request(app).get("/api-docs/");

    expect(res.status).toBe(404);
  });
});
