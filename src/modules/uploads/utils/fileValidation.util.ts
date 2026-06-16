/**
 * uploads — fileValidation.util
 * MIME type, extension, magic-byte, and file size validation.
 */
import { ValidationError } from "../../../shared/errors/app.errors.js";
import {
  BLOCKED_EXTENSIONS,
  BLOCKED_MIME_TYPES,
  DOCUMENT_EXTENSIONS,
  DOCUMENT_MIME_TYPES,
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TYPES,
  MIME_TO_EXTENSIONS,
  UPLOAD_MAX_FILE_SIZE_BYTES,
} from "../constants/upload.constants.js";
import type { UploadCategoryType } from "../types/upload.types.js";

export interface ValidatedUploadFile {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  extension: string;
  size: number;
}

interface MagicSignature {
  bytes: readonly number[];
  offset?: number;
}

const MAGIC_SIGNATURES: Record<string, readonly MagicSignature[]> = {
  "image/jpeg": [{ bytes: [0xff, 0xd8, 0xff] }],
  "image/png": [{ bytes: [0x89, 0x50, 0x4e, 0x47] }],
  "application/pdf": [{ bytes: [0x25, 0x50, 0x44, 0x46] }],
  "application/msword": [{ bytes: [0xd0, 0xcf, 0x11, 0xe0] }],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    { bytes: [0x50, 0x4b, 0x03, 0x04] },
    { bytes: [0x50, 0x4b, 0x05, 0x06] },
  ],
};

function normalizeExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return "";
  }

  return filename.slice(lastDotIndex).toLowerCase();
}

function getAllowedMimeTypes(category: UploadCategoryType): readonly string[] {
  return category === "IMAGE" ? IMAGE_MIME_TYPES : DOCUMENT_MIME_TYPES;
}

function getAllowedExtensions(category: UploadCategoryType): readonly string[] {
  return category === "IMAGE" ? IMAGE_EXTENSIONS : DOCUMENT_EXTENSIONS;
}

function bufferMatchesSignature(
  buffer: Buffer,
  signature: MagicSignature,
): boolean {
  const offset = signature.offset ?? 0;

  if (buffer.length < offset + signature.bytes.length) {
    return false;
  }

  return signature.bytes.every(
    (byte, index) => buffer[offset + index] === byte,
  );
}

function validateMagicBytes(buffer: Buffer, mimeType: string): void {
  const signatures = MAGIC_SIGNATURES[mimeType];

  if (!signatures) {
    return;
  }

  const matches = signatures.some((signature) =>
    bufferMatchesSignature(buffer, signature),
  );

  if (!matches) {
    throw new ValidationError("Validation failed", [
      {
        field: "file",
        message: "File content does not match declared MIME type",
      },
    ]);
  }
}

function rejectExecutableUpload(
  mimeType: string,
  extension: string,
  buffer: Buffer,
): void {
  if (
    BLOCKED_MIME_TYPES.includes(
      mimeType as (typeof BLOCKED_MIME_TYPES)[number],
    ) ||
    BLOCKED_EXTENSIONS.includes(
      extension as (typeof BLOCKED_EXTENSIONS)[number],
    )
  ) {
    throw new ValidationError("Validation failed", [
      {
        field: "file",
        message: "Executable or disallowed file types are not permitted",
      },
    ]);
  }

  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    throw new ValidationError("Validation failed", [
      {
        field: "file",
        message: "Executable or disallowed file types are not permitted",
      },
    ]);
  }
}

export function validateUploadFile(
  file: Express.Multer.File | undefined,
  category: UploadCategoryType,
): ValidatedUploadFile {
  if (!file) {
    throw new ValidationError("Validation failed", [
      { field: "file", message: "File is required" },
    ]);
  }

  if (!file.buffer || file.size === 0) {
    throw new ValidationError("Validation failed", [
      { field: "file", message: "Uploaded file is empty" },
    ]);
  }

  if (file.size > UPLOAD_MAX_FILE_SIZE_BYTES) {
    throw new ValidationError("Validation failed", [
      {
        field: "file",
        message: `File size must not exceed ${UPLOAD_MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
      },
    ]);
  }

  const mimeType = file.mimetype.toLowerCase();
  const extension = normalizeExtension(file.originalname);
  const allowedMimeTypes = getAllowedMimeTypes(category);
  const allowedExtensions = getAllowedExtensions(category);

  rejectExecutableUpload(mimeType, extension, file.buffer);

  if (!allowedMimeTypes.includes(mimeType)) {
    throw new ValidationError("Validation failed", [
      {
        field: "file",
        message: `Unsupported MIME type for ${category.toLowerCase()} upload`,
      },
    ]);
  }

  if (!extension || !allowedExtensions.includes(extension)) {
    throw new ValidationError("Validation failed", [
      {
        field: "file",
        message: `Unsupported file extension for ${category.toLowerCase()} upload`,
      },
    ]);
  }

  const mimeExtensions = MIME_TO_EXTENSIONS[mimeType] ?? [];
  if (!mimeExtensions.includes(extension)) {
    throw new ValidationError("Validation failed", [
      {
        field: "file",
        message: "File extension does not match MIME type",
      },
    ]);
  }

  validateMagicBytes(file.buffer, mimeType);

  return {
    buffer: file.buffer,
    mimeType,
    originalName: file.originalname,
    extension,
    size: file.size,
  };
}
