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
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SES_FROM_EMAIL: z.string().email().optional(),
  SES_FROM_NAME: z.string().optional(),
  SES_REPLY_TO_EMAIL: z.string().email().optional(),
  WEB_APP_BASE_URL: z.string().url().optional(),
  AWS_REGION: z.string().optional(),
  AWS_BUCKET_NAME: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_SIGNED_URL_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(3600),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  SYSTEM_ACTOR_USER_ID: z.string().uuid().optional(),
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
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    fromEmail: string;
  };
  ses: {
    fromEmail: string;
    fromName: string;
    replyToEmail: string;
  };
  corsOrigin: string;
  logLevel: z.infer<typeof logLevelSchema>;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  authRateLimitMax: number;
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
    smtp: {
      host: env.SMTP_HOST ?? "",
      port: env.SMTP_PORT ?? 587,
      user: env.SMTP_USER ?? "",
      pass: env.SMTP_PASS ?? "",
      fromEmail: env.SMTP_FROM_EMAIL ?? "",
    },
    ses: {
      fromEmail: env.SES_FROM_EMAIL ?? env.SMTP_FROM_EMAIL ?? "",
      fromName: env.SES_FROM_NAME ?? "Medical Equipment Marketplace",
      replyToEmail: env.SES_REPLY_TO_EMAIL ?? "",
    },
    corsOrigin: env.CORS_ORIGIN,
    logLevel: env.LOG_LEVEL,
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: env.RATE_LIMIT_MAX,
    authRateLimitMax: env.AUTH_RATE_LIMIT_MAX,
    aws: {
      region: env.AWS_REGION ?? "",
      bucketName: env.AWS_BUCKET_NAME ?? "",
      accessKeyId: env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? "",
      signedUrlExpiresInSeconds: env.AWS_SIGNED_URL_EXPIRES_IN_SECONDS,
    },
    razorpay: {
      keyId: env.RAZORPAY_KEY_ID ?? "",
      keySecret: env.RAZORPAY_KEY_SECRET ?? "",
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET ?? "",
    },
    systemActorUserId: env.SYSTEM_ACTOR_USER_ID ?? "",
  };
}

let cachedEnv: EnvConfig | undefined;

export function loadEnvConfig(): EnvConfig {
  if (!cachedEnv) {
    cachedEnv = parseEnvConfig();
  }

  return cachedEnv;
}

/** Validated environment configuration singleton. */
export const env = loadEnvConfig();
