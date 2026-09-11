/**
 * Map AWS S3 SDK failures to operational AppErrors with client-safe messages.
 * Raw provider details stay in server logs only.
 */
import { AppError } from "../../shared/errors/app.errors.js";
import { logger } from "../logger/logger.js";

export type S3Operation = "upload" | "delete" | "signedUrl";

const S3_ERROR_BY_OPERATION: Record<
  S3Operation,
  { message: string; code: string }
> = {
  upload: {
    message: "Failed to upload file",
    code: "STORAGE_UPLOAD_FAILED",
  },
  delete: {
    message: "Failed to delete file",
    code: "STORAGE_DELETE_FAILED",
  },
  signedUrl: {
    message: "Failed to generate download URL",
    code: "STORAGE_SIGNED_URL_FAILED",
  },
};

export function mapS3Error(error: unknown, operation: S3Operation): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const name = error instanceof Error ? error.name : "S3Error";

  logger.error(
    { err: error, provider: "aws-s3", errorName: name, operation },
    `S3 ${operation} failed`,
  );

  const mapped = S3_ERROR_BY_OPERATION[operation];
  return new AppError(mapped.message, 502, mapped.code);
}
