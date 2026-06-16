/**
 * AWS S3 client singleton — low-level SDK wrapper only.
 */
import { S3Client as AwsS3Client } from "@aws-sdk/client-s3";
import { AppError } from "../../shared/errors/app.errors.js";
import { isS3Configured, s3Config } from "./s3.config.js";

let cachedClient: AwsS3Client | null = null;

export function getS3Client(): AwsS3Client {
  if (!isS3Configured()) {
    throw new AppError(
      "File storage is not configured",
      503,
      "STORAGE_NOT_CONFIGURED",
    );
  }

  if (!cachedClient) {
    cachedClient = new AwsS3Client({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
    });
  }

  return cachedClient;
}

export function resetS3ClientForTests(): void {
  cachedClient = null;
}
