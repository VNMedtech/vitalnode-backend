/**
 * S3 upload operations — PutObject only, no business logic.
 */
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client } from "./s3.client.js";
import { s3Config } from "./s3.config.js";

export interface S3UploadInput {
  key: string;
  body: Buffer;
  contentType: string;
  contentLength: number;
}

export interface S3UploadResult {
  key: string;
  bucket: string;
  etag?: string;
}

export async function uploadObjectToS3(
  input: S3UploadInput,
): Promise<S3UploadResult> {
  const client = getS3Client();

  const result = await client.send(
    new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    }),
  );

  return {
    key: input.key,
    bucket: s3Config.bucket,
    etag: result.ETag,
  };
}
