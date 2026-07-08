import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("dotenv", () => ({
  config: vi.fn(),
}));

const BASE_ENV = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  JWT_SECRET: "change-me-min-32-characters-long!!",
  JWT_REFRESH_SECRET: "change-me-min-32-characters-long!!",
} as const;

describe("env production guards", () => {
  const savedNodeEnv = process.env.NODE_ENV;
  const savedCorsOrigin = process.env.CORS_ORIGIN;

  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = BASE_ENV.DATABASE_URL;
    process.env.JWT_SECRET = BASE_ENV.JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = BASE_ENV.JWT_REFRESH_SECRET;
  });

  afterEach(() => {
    vi.resetModules();

    if (savedNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = savedNodeEnv;
    }

    if (savedCorsOrigin === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = savedCorsOrigin;
    }
  });

  async function loadConfig() {
    vi.resetModules();
    const { loadEnvConfig, resetEnvConfigCache } = await import(
      "../../../src/config/env.js"
    );
    resetEnvConfigCache();
    return loadEnvConfig();
  }

  it("fails startup when CORS_ORIGIN is * in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGIN = "*";

    await expect(loadConfig()).rejects.toThrow(
      "CORS_ORIGIN must not be '*' in production",
    );
  });

  it("allows CORS_ORIGIN * in development", async () => {
    process.env.NODE_ENV = "development";
    process.env.CORS_ORIGIN = "*";

    const config = await loadConfig();

    expect(config.corsOrigin).toBe("*");
    expect(config.nodeEnv).toBe("development");
  });

  it("parses TRUST_PROXY=true", async () => {
    process.env.NODE_ENV = "development";
    process.env.TRUST_PROXY = "true";

    const config = await loadConfig();

    expect(config.trustProxy).toBe(true);
  });

  it("defaults TRUST_PROXY to false", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.TRUST_PROXY;

    const config = await loadConfig();

    expect(config.trustProxy).toBe(false);
  });
});

describe("cors multi-origin parsing", () => {
  const savedNodeEnv = process.env.NODE_ENV;
  const savedCorsOrigin = process.env.CORS_ORIGIN;

  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = BASE_ENV.DATABASE_URL;
    process.env.JWT_SECRET = BASE_ENV.JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = BASE_ENV.JWT_REFRESH_SECRET;
  });

  afterEach(() => {
    vi.resetModules();

    if (savedNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = savedNodeEnv;
    }

    if (savedCorsOrigin === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = savedCorsOrigin;
    }
  });

  it("parses comma-separated CORS origins", async () => {
    process.env.CORS_ORIGIN =
      "https://buyer.example.com, https://seller.example.com";

    vi.resetModules();
    const { corsOptions } = await import("../../../src/config/cors.js");

    expect(corsOptions.origin).toEqual([
      "https://buyer.example.com",
      "https://seller.example.com",
    ]);
  });
});
