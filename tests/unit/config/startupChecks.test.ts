import { describe, expect, it, vi } from "vitest";
import type { EnvConfig } from "../../../src/config/env.js";
import { runStartupChecks } from "../../../src/config/startupChecks.js";

vi.mock("../../../src/infrastructure/logger/logger.js", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { logger } from "../../../src/infrastructure/logger/logger.js";

function createProductionConfig(
  overrides: Partial<EnvConfig> = {},
): EnvConfig {
  return {
    nodeEnv: "production",
    port: 3000,
    databaseUrl: "postgresql://user:pass@localhost:5432/test",
    jwtSecret: "change-me-min-32-characters-long!!",
    jwtRefreshSecret: "change-me-min-32-characters-long!!",
    jwtAccessExpiresIn: "15m",
    jwtRefreshExpiresIn: "7d",
    bcryptSaltRounds: 10,
    passwordResetTokenExpiresInMinutes: 30,
    webAppBaseUrl: "",
    webAppUrls: {
      store: "",
      seller: "",
      admin: "",
      delivery: "",
      fallback: "",
    },
    smtp: {
      host: "",
      port: 587,
      user: "",
      pass: "",
      fromEmail: "",
    },
    ses: {
      region: "",
      accessKeyId: "",
      secretAccessKey: "",
      fromEmail: "",
      fromName: "Medical Equipment Marketplace",
      replyToEmail: "",
    },
    corsOrigin: "https://buyer.example.com",
    logLevel: "info",
    rateLimitWindowMs: 900_000,
    rateLimitMax: 100,
    authRateLimitMax: 20,
    trustProxy: false,
    aws: {
      region: "",
      bucketName: "",
      accessKeyId: "",
      secretAccessKey: "",
      signedUrlExpiresInSeconds: 3600,
    },
    razorpay: {
      keyId: "",
      keySecret: "",
      webhookSecret: "",
    },
    systemActorUserId: "",
    pendingPaymentTtlMinutes: 30,
    pendingPaymentSweepIntervalMs: 300_000,
    readNotificationTtlDays: 30,
    readNotificationSweepIntervalMs: 86_400_000,
    idempotencyTtlMs: 86_400_000,
    idempotencySweepIntervalMs: 3_600_000,
    ...overrides,
  };
}

describe("runStartupChecks", () => {
  it("does not warn outside production", () => {
    runStartupChecks(createProductionConfig({ nodeEnv: "development" }));

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("warns when S3 config is incomplete in production", () => {
    vi.mocked(logger.warn).mockClear();

    runStartupChecks(createProductionConfig());

    expect(logger.warn).toHaveBeenCalledWith(
      {
        missing: expect.arrayContaining([
          "AWS_S3_REGION",
          "AWS_S3_BUCKET_NAME",
          "AWS_S3_ACCESS_KEY_ID",
          "AWS_S3_SECRET_ACCESS_KEY",
        ]),
        integration: "s3",
      },
      "Production integration config incomplete",
    );
  });

  it("warns when SES config is incomplete in production", () => {
    vi.mocked(logger.warn).mockClear();

    runStartupChecks(createProductionConfig());

    expect(logger.warn).toHaveBeenCalledWith(
      {
        missing: expect.arrayContaining([
          "AWS_SES_REGION",
          "AWS_SES_ACCESS_KEY_ID",
          "AWS_SES_SECRET_ACCESS_KEY",
          "SES_FROM_EMAIL",
        ]),
        integration: "ses",
      },
      "Production integration config incomplete",
    );
  });

  it("warns when Razorpay config is incomplete in production", () => {
    vi.mocked(logger.warn).mockClear();

    runStartupChecks(createProductionConfig());

    expect(logger.warn).toHaveBeenCalledWith(
      {
        missing: expect.arrayContaining([
          "RAZORPAY_KEY_ID",
          "RAZORPAY_KEY_SECRET",
          "RAZORPAY_WEBHOOK_SECRET",
          "SYSTEM_ACTOR_USER_ID",
        ]),
        integration: "razorpay",
      },
      "Production integration config incomplete",
    );
  });

  it("does not warn when all integrations are configured", () => {
    vi.mocked(logger.warn).mockClear();

    runStartupChecks(
      createProductionConfig({
        aws: {
          region: "ap-south-1",
          bucketName: "bucket",
          accessKeyId: "key",
          secretAccessKey: "secret",
          signedUrlExpiresInSeconds: 3600,
        },
        ses: {
          region: "ap-south-1",
          accessKeyId: "ses-key",
          secretAccessKey: "ses-secret",
          fromEmail: "noreply@example.com",
          fromName: "Test",
          replyToEmail: "support@example.com",
        },
        razorpay: {
          keyId: "rzp_test",
          keySecret: "secret",
          webhookSecret: "whsec",
        },
        systemActorUserId: "00000000-0000-4000-8000-000000000001",
      }),
    );

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
