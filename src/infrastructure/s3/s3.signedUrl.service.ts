/**
 * S3 signed URL generation and public object URL helpers.
 */
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "./s3.client.js";
import { s3Config } from "./s3.config.js";

export async function generateSignedDownloadUrl(
  key: string,
  expiresInSeconds = s3Config.signedUrlExpiresInSeconds,
): Promise<string> {
  const client = getS3Client();

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
    }),
    { expiresIn: expiresInSeconds },
  );
}

export function buildS3ObjectUrl(key: string): string {
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${encodedKey}`;
}
