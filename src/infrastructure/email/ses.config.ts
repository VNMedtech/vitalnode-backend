/**
 * AWS SES client configuration.
 */
import { env } from "../../config/env.js";

export const sesConfig = {
  region: env.aws.region,
  accessKeyId: env.aws.accessKeyId,
  secretAccessKey: env.aws.secretAccessKey,
  fromEmail: env.ses.fromEmail,
  fromName: env.ses.fromName,
  replyToEmail: env.ses.replyToEmail,
} as const;

export function isSesConfigured(): boolean {
  return Boolean(
    sesConfig.region &&
      sesConfig.accessKeyId &&
      sesConfig.secretAccessKey &&
      sesConfig.fromEmail,
  );
}

export function formatSesFromAddress(): string {
  if (sesConfig.fromName) {
    return `${sesConfig.fromName} <${sesConfig.fromEmail}>`;
  }

  return sesConfig.fromEmail;
}
