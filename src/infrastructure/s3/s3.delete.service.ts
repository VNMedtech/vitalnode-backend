/**
 * S3 delete operations — DeleteObject only, no business logic.
 */
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client } from "./s3.client.js";
import { s3Config } from "./s3.config.js";
import { mapS3Error } from "./s3.errors.js";

export async function deleteObjectFromS3(key: string): Promise<void> {
  try {
    const client = getS3Client();

    await client.send(
      new DeleteObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
      }),
    );
  } catch (error) {
    throw mapS3Error(error, "delete");
  }
}
