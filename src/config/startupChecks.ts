/**
 * Non-fatal startup warnings for incomplete production integration config.
 */
import type { EnvConfig } from "./env.js";
import { logger } from "../infrastructure/logger/logger.js";

function missingFields(
  fields: Record<string, string>,
): string[] {
  return Object.entries(fields)
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

export function runStartupChecks(config: EnvConfig): void {
  if (config.nodeEnv !== "production") {
    return;
  }

  const s3Missing = missingFields({
    AWS_S3_REGION: config.aws.region,
    AWS_S3_BUCKET_NAME: config.aws.bucketName,
    AWS_S3_ACCESS_KEY_ID: config.aws.accessKeyId,
    AWS_S3_SECRET_ACCESS_KEY: config.aws.secretAccessKey,
  });

  if (s3Missing.length > 0) {
    logger.warn(
      { missing: s3Missing, integration: "s3" },
      "Production integration config incomplete",
    );
  }

  const sesMissing = missingFields({
    AWS_SES_REGION: config.ses.region,
    AWS_SES_ACCESS_KEY_ID: config.ses.accessKeyId,
    AWS_SES_SECRET_ACCESS_KEY: config.ses.secretAccessKey,
    SES_FROM_EMAIL: config.ses.fromEmail,
  });

  if (sesMissing.length > 0) {
    logger.warn(
      { missing: sesMissing, integration: "ses" },
      "Production integration config incomplete",
    );
  }

  const razorpayMissing = missingFields({
    RAZORPAY_KEY_ID: config.razorpay.keyId,
    RAZORPAY_KEY_SECRET: config.razorpay.keySecret,
    RAZORPAY_WEBHOOK_SECRET: config.razorpay.webhookSecret,
    SYSTEM_ACTOR_USER_ID: config.systemActorUserId,
  });

  if (razorpayMissing.length > 0) {
    logger.warn(
      { missing: razorpayMissing, integration: "razorpay" },
      "Production integration config incomplete",
    );
  }
}
