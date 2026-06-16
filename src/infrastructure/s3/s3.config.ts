/**
 * AWS S3 client configuration.
 */
import { env } from "../../config/env.js";

export const s3Config = {
  region: env.aws.region,
  bucket: env.aws.bucketName,
  accessKeyId: env.aws.accessKeyId,
  secretAccessKey: env.aws.secretAccessKey,
  signedUrlExpiresInSeconds: env.aws.signedUrlExpiresInSeconds,
} as const;

export function isS3Configured(): boolean {
  return Boolean(
    s3Config.region &&
      s3Config.bucket &&
      s3Config.accessKeyId &&
      s3Config.secretAccessKey,
  );
}
