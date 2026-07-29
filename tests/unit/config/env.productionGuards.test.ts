import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("dotenv", () => ({
  config: vi.fn(),
}));

const BASE_ENV = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  JWT_SECRET: "change-me-min-32-characters-long!!",
  JWT_REFRESH_SECRET: "change-me-min-32-characters-long!!",
} as const;

const PRODUCTION_INTEGRATION_KEYS = [
  "AWS_S3_REGION",
  "AWS_S3_BUCKET_NAME",
  "AWS_S3_ACCESS_KEY_ID",
  "AWS_S3_SECRET_ACCESS_KEY",
  "AWS_SES_REGION",
  "AWS_SES_ACCESS_KEY_ID",
  "AWS_SES_SECRET_ACCESS_KEY",
  "SES_FROM_EMAIL",
  "SMTP_FROM_EMAIL",
  "AWS_REGION",
  "AWS_BUCKET_NAME",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "SYSTEM_ACTOR_USER_ID",
] as const;

function clearProductionIntegrationEnv(): void {
  for (const key of PRODUCTION_INTEGRATION_KEYS) {
    delete process.env[key];
  }
}

function setValidProductionIntegrations(): void {
  process.env.AWS_S3_REGION = "ap-south-1";
  process.env.AWS_S3_BUCKET_NAME = "prod-bucket";
  process.env.AWS_S3_ACCESS_KEY_ID = "s3-key";
  process.env.AWS_S3_SECRET_ACCESS_KEY = "s3-secret";
  process.env.AWS_SES_REGION = "ap-south-1";
  process.env.AWS_SES_ACCESS_KEY_ID = "ses-key";
  process.env.AWS_SES_SECRET_ACCESS_KEY = "ses-secret";
  process.env.SES_FROM_EMAIL = "noreply@example.com";
  process.env.RAZORPAY_KEY_ID = "rzp_live_key";
  process.env.RAZORPAY_KEY_SECRET = "rzp_live_secret_32_chars_min!!";
  process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_live_secret_32_chars_min!";
  process.env.SYSTEM_ACTOR_USER_ID = "00000000-0000-4000-8000-000000000099";
}

describe("env production guards", () => {
  const savedEnv: Record<string, string | undefined> = {};
  const trackedKeys = [
    "NODE_ENV",
    "CORS_ORIGIN",
    "TRUST_PROXY",
    "DATABASE_URL",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    ...PRODUCTION_INTEGRATION_KEYS,
  ] as const;

  beforeEach(() => {
    vi.resetModules();
    for (const key of trackedKeys) {
      savedEnv[key] = process.env[key];
    }
    process.env.DATABASE_URL = BASE_ENV.DATABASE_URL;
    process.env.JWT_SECRET = BASE_ENV.JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = BASE_ENV.JWT_REFRESH_SECRET;
    clearProductionIntegrationEnv();
  });

  afterEach(() => {
    vi.resetModules();

    for (const key of trackedKeys) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
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

  it("fails startup when production integration config is missing", async () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGIN = "https://admin.example.com";

    await expect(loadConfig()).rejects.toThrow(
      /Missing required production integration configuration/,
    );
    await expect(loadConfig()).rejects.toThrow(/AWS_S3_REGION/);
    await expect(loadConfig()).rejects.toThrow(/AWS_SES_ACCESS_KEY_ID/);
    await expect(loadConfig()).rejects.toThrow(/RAZORPAY_KEY_ID/);
    await expect(loadConfig()).rejects.toThrow(/SYSTEM_ACTOR_USER_ID/);
  });

  it("allows production startup when S3, SES, Razorpay, and system actor are set", async () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGIN = "https://admin.example.com";
    setValidProductionIntegrations();

    const config = await loadConfig();

    expect(config.nodeEnv).toBe("production");
    expect(config.corsOrigin).toBe("https://admin.example.com");
    expect(config.aws.region).toBe("ap-south-1");
    expect(config.ses.accessKeyId).toBe("ses-key");
    expect(config.razorpay.keyId).toBe("rzp_live_key");
    expect(config.systemActorUserId).toBe(
      "00000000-0000-4000-8000-000000000099",
    );
  });

  it("accepts legacy AWS_* fallback for S3 but still requires dedicated SES keys", async () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGIN = "https://admin.example.com";
    process.env.AWS_REGION = "eu-west-1";
    process.env.AWS_BUCKET_NAME = "legacy-bucket";
    process.env.AWS_ACCESS_KEY_ID = "legacy-key";
    process.env.AWS_SECRET_ACCESS_KEY = "legacy-secret";
    process.env.SES_FROM_EMAIL = "noreply@example.com";
    process.env.RAZORPAY_KEY_ID = "rzp_live_key";
    process.env.RAZORPAY_KEY_SECRET = "rzp_live_secret_32_chars_min!!";
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_live_secret_32_chars_min!";
    process.env.SYSTEM_ACTOR_USER_ID = "00000000-0000-4000-8000-000000000099";

    await expect(loadConfig()).rejects.toThrow(/AWS_SES_ACCESS_KEY_ID/);
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
