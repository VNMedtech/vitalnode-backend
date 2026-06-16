/**
 * uploads — upload.constants
 * Module-specific constants and configuration values.
 */
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { MAX_FILE_SIZE_BYTES } from "../../../shared/constants/app.constants.js";
import type { UploadTypeValue } from "../types/upload.types.js";

export const UPLOAD_MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_BYTES;

export const UPLOAD_FIELD_NAME = "file";
export const UPLOAD_TYPE_FIELD_NAME = "uploadType";

export const UPLOAD_TYPES = {
  PRODUCT_IMAGE: "PRODUCT_IMAGE",
  PRODUCT_DOCUMENT: "PRODUCT_DOCUMENT",
  HANDOVER_PROOF: "HANDOVER_PROOF",
  DELIVERY_PROOF: "DELIVERY_PROOF",
  PROFILE_IMAGE: "PROFILE_IMAGE",
} as const;

export const IMAGE_UPLOAD_TYPES = [
  UPLOAD_TYPES.PRODUCT_IMAGE,
  UPLOAD_TYPES.HANDOVER_PROOF,
  UPLOAD_TYPES.DELIVERY_PROOF,
  UPLOAD_TYPES.PROFILE_IMAGE,
] as const satisfies readonly UploadTypeValue[];

export const DOCUMENT_UPLOAD_TYPES = [
  UPLOAD_TYPES.PRODUCT_DOCUMENT,
] as const satisfies readonly UploadTypeValue[];

export const UPLOAD_TYPE_S3_PREFIX: Record<UploadTypeValue, string> = {
  [UPLOAD_TYPES.PRODUCT_IMAGE]: "uploads/products",
  [UPLOAD_TYPES.PRODUCT_DOCUMENT]: "uploads/products",
  [UPLOAD_TYPES.HANDOVER_PROOF]: "uploads/proofs",
  [UPLOAD_TYPES.DELIVERY_PROOF]: "uploads/proofs",
  [UPLOAD_TYPES.PROFILE_IMAGE]: "uploads/profiles",
};

export const UPLOAD_TYPE_CATEGORY: Record<
  UploadTypeValue,
  "IMAGE" | "DOCUMENT"
> = {
  [UPLOAD_TYPES.PRODUCT_IMAGE]: "IMAGE",
  [UPLOAD_TYPES.PRODUCT_DOCUMENT]: "DOCUMENT",
  [UPLOAD_TYPES.HANDOVER_PROOF]: "IMAGE",
  [UPLOAD_TYPES.DELIVERY_PROOF]: "IMAGE",
  [UPLOAD_TYPES.PROFILE_IMAGE]: "IMAGE",
};

export const UPLOAD_TYPE_ALLOWED_ROLES: Record<
  UploadTypeValue,
  readonly UserRole[]
> = {
  [UPLOAD_TYPES.PRODUCT_IMAGE]: [UserRole.SELLER, UserRole.ADMIN],
  [UPLOAD_TYPES.PRODUCT_DOCUMENT]: [UserRole.SELLER, UserRole.ADMIN],
  [UPLOAD_TYPES.HANDOVER_PROOF]: [UserRole.SELLER, UserRole.ADMIN],
  [UPLOAD_TYPES.DELIVERY_PROOF]: [
    UserRole.DELIVERY_PARTNER,
    UserRole.ADMIN,
  ],
  [UPLOAD_TYPES.PROFILE_IMAGE]: [
    UserRole.BUYER,
    UserRole.SELLER,
    UserRole.DELIVERY_PARTNER,
    UserRole.ADMIN,
  ],
};

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png"] as const;

export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png"] as const;

export const DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;

export const MIME_TO_EXTENSIONS: Record<string, readonly string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
};

export const BLOCKED_MIME_TYPES = [
  "application/x-msdownload",
  "application/x-executable",
  "application/x-msdos-program",
  "application/x-sh",
  "application/javascript",
  "text/javascript",
  "application/x-httpd-php",
  "application/php",
  "application/octet-stream",
] as const;

export const BLOCKED_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".dll",
  ".sh",
  ".bash",
  ".js",
  ".php",
  ".html",
  ".htm",
  ".svg",
  ".jar",
  ".app",
] as const;

export const UPLOAD_AUDIT_ENTITY_TYPE = "FILE_UPLOAD";

export const UPLOAD_ACTIONS = {
  CREATE: "FILE_UPLOAD_CREATE",
  REPLACE: "FILE_UPLOAD_REPLACE",
  DELETE: "FILE_UPLOAD_DELETE",
} as const;
