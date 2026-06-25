import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("dotenv", () => ({
  config: vi.fn(),
}));

const AWS_ENV_KEYS = [
  "AWS_S3_REGION",
  "AWS_S3_BUCKET_NAME",
  "AWS_S3_ACCESS_KEY_ID",
  "AWS_S3_SECRET_ACCESS_KEY",
  "AWS_S3_SIGNED_URL_EXPIRES_IN_SECONDS",
  "AWS_SES_REGION",
  "AWS_SES_ACCESS_KEY_ID",
  "AWS_SES_SECRET_ACCESS_KEY",
  "AWS_REGION",
  "AWS_BUCKET_NAME",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SIGNED_URL_EXPIRES_IN_SECONDS",
  "SES_FROM_EMAIL",
] as const;

describe("env AWS split credentials", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of AWS_ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    vi.resetModules();

    for (const key of AWS_ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  async function loadConfig() {
    vi.resetModules();
    const { loadEnvConfig } = await import("../../../src/config/env.js");
    return loadEnvConfig();
  }

  it("uses AWS_S3_* for S3 and AWS_SES_* for SES when both are set", async () => {
    process.env.AWS_S3_REGION = "ap-south-1";
    process.env.AWS_S3_BUCKET_NAME = "s3-bucket";
    process.env.AWS_S3_ACCESS_KEY_ID = "s3-key";
    process.env.AWS_S3_SECRET_ACCESS_KEY = "s3-secret";
    process.env.AWS_S3_SIGNED_URL_EXPIRES_IN_SECONDS = "7200";
    process.env.AWS_SES_REGION = "us-east-1";
    process.env.AWS_SES_ACCESS_KEY_ID = "ses-key";
    process.env.AWS_SES_SECRET_ACCESS_KEY = "ses-secret";
    process.env.SES_FROM_EMAIL = "noreply@example.com";

    const config = await loadConfig();

    expect(config.aws).toEqual({
      region: "ap-south-1",
      bucketName: "s3-bucket",
      accessKeyId: "s3-key",
      secretAccessKey: "s3-secret",
      signedUrlExpiresInSeconds: 7200,
    });
    expect(config.ses.accessKeyId).toBe("ses-key");
    expect(config.ses.secretAccessKey).toBe("ses-secret");
    expect(config.ses.region).toBe("us-east-1");
  });

  it("falls back to legacy AWS_* for S3 only when AWS_S3_* is unset", async () => {
    process.env.AWS_REGION = "eu-west-1";
    process.env.AWS_BUCKET_NAME = "legacy-bucket";
    process.env.AWS_ACCESS_KEY_ID = "legacy-key";
    process.env.AWS_SECRET_ACCESS_KEY = "legacy-secret";
    process.env.AWS_SIGNED_URL_EXPIRES_IN_SECONDS = "1800";

    const config = await loadConfig();

    expect(config.aws).toEqual({
      region: "eu-west-1",
      bucketName: "legacy-bucket",
      accessKeyId: "legacy-key",
      secretAccessKey: "legacy-secret",
      signedUrlExpiresInSeconds: 1800,
    });
    expect(config.ses.accessKeyId).toBe("");
    expect(config.ses.secretAccessKey).toBe("");
  });

  it("does not use S3 credentials for SES", async () => {
    process.env.AWS_S3_ACCESS_KEY_ID = "s3-only-key";
    process.env.AWS_S3_SECRET_ACCESS_KEY = "s3-only-secret";
    process.env.AWS_ACCESS_KEY_ID = "legacy-s3-key";
    process.env.AWS_SECRET_ACCESS_KEY = "legacy-s3-secret";

    const config = await loadConfig();

    expect(config.aws.accessKeyId).toBe("s3-only-key");
    expect(config.ses.accessKeyId).toBe("");
    expect(config.ses.secretAccessKey).toBe("");
  });

  it("falls back SES region to AWS_REGION when AWS_SES_REGION is unset", async () => {
    process.env.AWS_REGION = "ap-south-1";
    process.env.AWS_SES_ACCESS_KEY_ID = "ses-key";
    process.env.AWS_SES_SECRET_ACCESS_KEY = "ses-secret";

    const config = await loadConfig();

    expect(config.ses.region).toBe("ap-south-1");
  });

  it("prefers AWS_S3_* over legacy AWS_* for S3", async () => {
    process.env.AWS_S3_REGION = "ap-south-1";
    process.env.AWS_S3_BUCKET_NAME = "preferred-bucket";
    process.env.AWS_S3_ACCESS_KEY_ID = "preferred-key";
    process.env.AWS_S3_SECRET_ACCESS_KEY = "preferred-secret";
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_BUCKET_NAME = "legacy-bucket";
    process.env.AWS_ACCESS_KEY_ID = "legacy-key";
    process.env.AWS_SECRET_ACCESS_KEY = "legacy-secret";

    const config = await loadConfig();

    expect(config.aws.region).toBe("ap-south-1");
    expect(config.aws.bucketName).toBe("preferred-bucket");
    expect(config.aws.accessKeyId).toBe("preferred-key");
    expect(config.aws.secretAccessKey).toBe("preferred-secret");
  });
});
