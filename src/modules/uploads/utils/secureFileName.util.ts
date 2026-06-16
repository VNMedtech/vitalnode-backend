/**
 * uploads — secureFileName.util
 * Generates unpredictable S3 object keys with sanitized extensions.
 */
import { randomUUID } from "node:crypto";
import { UPLOAD_TYPE_S3_PREFIX } from "../constants/upload.constants.js";
import type { UploadTypeValue } from "../types/upload.types.js";

export function buildSecureS3Key(
  uploadType: UploadTypeValue,
  extension: string,
): string {
  const prefix = UPLOAD_TYPE_S3_PREFIX[uploadType];
  const safeExtension = extension.startsWith(".") ? extension : `.${extension}`;

  return `${prefix}/${randomUUID()}${safeExtension}`;
}
