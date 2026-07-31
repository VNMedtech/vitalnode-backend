/**
 * Typed environment variable access and validation.
 * Loads `.env` via dotenv and validates all required configuration at startup.
 */
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const nodeEnvSchema = z.enum(["development", "test", "production"]);

const logLevelSchema = z.enum([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
]);

const envSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(15).default(10),
  PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(30),
  CORS_ORIGIN: z.string().default("*"),
  LOG_LEVEL: logLevelSchema.default("info"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  TRUST_PROXY: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SES_FROM_EMAIL: z.string().email().optional(),
  SES_FROM_NAME: z.string().optional(),
  SES_REPLY_TO_EMAIL: z.string().email().optional(),
  WEB_APP_BASE_URL: z.string().url().optional(),
  WEB_APP_STORE_URL: z.string().url().optional(),
  WEB_APP_SELLER_URL: z.string().url().optional(),
  WEB_APP_ADMIN_URL: z.string().url().optional(),
  WEB_APP_DELIVERY_URL: z.string().url().optional(),
  AWS_S3_REGION: z.string().optional(),
  AWS_S3_BUCKET_NAME: z.string().optional(),
  AWS_S3_ACCESS_KEY_ID: z.string().optional(),
  AWS_S3_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_SIGNED_URL_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .optional(),
  AWS_SES_REGION: z.string().optional(),
  AWS_SES_ACCESS_KEY_ID: z.string().optional(),
  AWS_SES_SECRET_ACCESS_KEY: z.string().optional(),
  /** @deprecated Use AWS_S3_* — kept as S3-only fallback */
  AWS_REGION: z.string().optional(),
  /** @deprecated Use AWS_S3_* — kept as S3-only fallback */
  AWS_BUCKET_NAME: z.string().optional(),
  /** @deprecated Use AWS_S3_* — kept as S3-only fallback */
  AWS_ACCESS_KEY_ID: z.string().optional(),
  /** @deprecated Use AWS_S3_* — kept as S3-only fallback */
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  /** @deprecated Use AWS_S3_* — kept as S3-only fallback */
  AWS_SIGNED_URL_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(3600),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  SYSTEM_ACTOR_USER_ID: z.string().uuid().optional(),
  /** Auto-cancel PENDING_PAYMENT orders older than this many minutes. */
  PENDING_PAYMENT_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  /** How often the stale unpaid-order sweep runs (ms). */
  PENDING_PAYMENT_SWEEP_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(300_000),
  /** Hard-delete read in-app notifications older than this many days. */
  READ_NOTIFICATION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** How often the read-notification cleanup sweep runs (ms). */
  READ_NOTIFICATION_SWEEP_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(86_400_000),
  /** Idempotency key replay window written to expiresAt on create (ms). */
  IDEMPOTENCY_TTL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(86_400_000),
  /** How often the expired idempotency-key purge runs (ms). */
  IDEMPOTENCY_SWEEP_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(3_600_000),
});

export interface EnvConfig {
  nodeEnv: z.infer<typeof nodeEnvSchema>;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  bcryptSaltRounds: number;
  passwordResetTokenExpiresInMinutes: number;
  webAppBaseUrl: string;
  webAppUrls: {
    store: string;
    seller: string;
    admin: string;
    delivery: string;
    fallback: string;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    fromEmail: string;
  };
  ses: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    fromEmail: string;
    fromName: string;
    replyToEmail: string;
  };
  corsOrigin: string;
  logLevel: z.infer<typeof logLevelSchema>;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  authRateLimitMax: number;
  trustProxy: boolean;
  aws: {
    region: string;
    bucketName: string;
    accessKeyId: string;
    secretAccessKey: string;
    signedUrlExpiresInSeconds: number;
  };
  razorpay: {
    keyId: string;
    keySecret: string;
    webhookSecret: string;
  };
  systemActorUserId: string;
  pendingPaymentTtlMinutes: number;
  pendingPaymentSweepIntervalMs: number;
  readNotificationTtlDays: number;
  readNotificationSweepIntervalMs: number;
  idempotencyTtlMs: number;
  idempotencySweepIntervalMs: number;
}

function parseEnvConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }

  const env = result.data;

  if (env.NODE_ENV === "production" && env.CORS_ORIGIN === "*") {
    throw new Error(
      "CORS_ORIGIN must not be '*' in production. Set explicit portal origin(s).",
    );
  }

  if (env.NODE_ENV === "production") {
    const missing: string[] = [];

    // S3 (uploads, invoices)
    if (!(env.AWS_S3_REGION ?? env.AWS_REGION)) missing.push("AWS_S3_REGION");
    if (!(env.AWS_S3_BUCKET_NAME ?? env.AWS_BUCKET_NAME))
      missing.push("AWS_S3_BUCKET_NAME");
    if (!(env.AWS_S3_ACCESS_KEY_ID ?? env.AWS_ACCESS_KEY_ID))
      missing.push("AWS_S3_ACCESS_KEY_ID");
    if (!(env.AWS_S3_SECRET_ACCESS_KEY ?? env.AWS_SECRET_ACCESS_KEY))
      missing.push("AWS_S3_SECRET_ACCESS_KEY");

    // SES (transactional email)
    if (!(env.AWS_SES_REGION ?? env.AWS_REGION)) missing.push("AWS_SES_REGION");
    if (!env.AWS_SES_ACCESS_KEY_ID) missing.push("AWS_SES_ACCESS_KEY_ID");
    if (!env.AWS_SES_SECRET_ACCESS_KEY)
      missing.push("AWS_SES_SECRET_ACCESS_KEY");
    if (!(env.SES_FROM_EMAIL ?? env.SMTP_FROM_EMAIL)) missing.push("SES_FROM_EMAIL");

    // Razorpay (payments)
    if (!env.RAZORPAY_KEY_ID) missing.push("RAZORPAY_KEY_ID");
    if (!env.RAZORPAY_KEY_SECRET) missing.push("RAZORPAY_KEY_SECRET");
    if (!env.RAZORPAY_WEBHOOK_SECRET) missing.push("RAZORPAY_WEBHOOK_SECRET");
    if (!env.SYSTEM_ACTOR_USER_ID) missing.push("SYSTEM_ACTOR_USER_ID");

    if (missing.length > 0) {
      throw new Error(
        `Missing required production integration configuration:\n${missing
          .map((k) => `- ${k}`)
          .join("\n")}`,
      );
    }
  }

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    jwtSecret: env.JWT_SECRET,
    jwtRefreshSecret: env.JWT_REFRESH_SECRET,
    jwtAccessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    jwtRefreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
    passwordResetTokenExpiresInMinutes:
      env.PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES,
    webAppBaseUrl: env.WEB_APP_BASE_URL ?? "",
    webAppUrls: {
      store: env.WEB_APP_STORE_URL ?? "",
      seller: env.WEB_APP_SELLER_URL ?? "",
      admin: env.WEB_APP_ADMIN_URL ?? "",
      delivery: env.WEB_APP_DELIVERY_URL ?? "",
      fallback: env.WEB_APP_BASE_URL ?? "",
    },
    smtp: {
      host: env.SMTP_HOST ?? "",
      port: env.SMTP_PORT ?? 587,
      user: env.SMTP_USER ?? "",
      pass: env.SMTP_PASS ?? "",
      fromEmail: env.SMTP_FROM_EMAIL ?? "",
    },
    ses: {
      region: env.AWS_SES_REGION ?? env.AWS_REGION ?? "",
      accessKeyId: env.AWS_SES_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.AWS_SES_SECRET_ACCESS_KEY ?? "",
      fromEmail: env.SES_FROM_EMAIL ?? env.SMTP_FROM_EMAIL ?? "",
      fromName: env.SES_FROM_NAME ?? "VitalNode Marketplace",
      replyToEmail: env.SES_REPLY_TO_EMAIL ?? "",
    },
    corsOrigin: env.CORS_ORIGIN,
    logLevel: env.LOG_LEVEL,
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: env.RATE_LIMIT_MAX,
    authRateLimitMax: env.AUTH_RATE_LIMIT_MAX,
    trustProxy: env.TRUST_PROXY,
    aws: {
      region: env.AWS_S3_REGION ?? env.AWS_REGION ?? "",
      bucketName: env.AWS_S3_BUCKET_NAME ?? env.AWS_BUCKET_NAME ?? "",
      accessKeyId: env.AWS_S3_ACCESS_KEY_ID ?? env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey:
        env.AWS_S3_SECRET_ACCESS_KEY ?? env.AWS_SECRET_ACCESS_KEY ?? "",
      signedUrlExpiresInSeconds:
        env.AWS_S3_SIGNED_URL_EXPIRES_IN_SECONDS ??
        env.AWS_SIGNED_URL_EXPIRES_IN_SECONDS,
    },
    razorpay: {
      keyId: env.RAZORPAY_KEY_ID ?? "",
      keySecret: env.RAZORPAY_KEY_SECRET ?? "",
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET ?? "",
    },
    systemActorUserId: env.SYSTEM_ACTOR_USER_ID ?? "",
    pendingPaymentTtlMinutes: env.PENDING_PAYMENT_TTL_MINUTES,
    pendingPaymentSweepIntervalMs: env.PENDING_PAYMENT_SWEEP_INTERVAL_MS,
    readNotificationTtlDays: env.READ_NOTIFICATION_TTL_DAYS,
    readNotificationSweepIntervalMs: env.READ_NOTIFICATION_SWEEP_INTERVAL_MS,
    idempotencyTtlMs: env.IDEMPOTENCY_TTL_MS,
    idempotencySweepIntervalMs: env.IDEMPOTENCY_SWEEP_INTERVAL_MS,
  };
}

let cachedEnv: EnvConfig | undefined;

export function loadEnvConfig(): EnvConfig {
  if (!cachedEnv) {
    cachedEnv = parseEnvConfig();
  }

  return cachedEnv;
}

/** Clears the cached config so the next `loadEnvConfig()` re-reads `process.env`. */
export function resetEnvConfigCache(): void {
  cachedEnv = undefined;
}

/** Validated environment configuration singleton. */
export const env = loadEnvConfig();
