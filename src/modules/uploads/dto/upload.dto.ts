/**
 * uploads — upload.dto
 * Response mappers for upload records.
 */
import {
  buildS3ObjectUrl,
  generateSignedDownloadUrl,
} from "../../../infrastructure/s3/index.js";
import type { UploadRecord } from "../repositories/upload.repository.js";
import type {
  FileMetadataDto,
  SignedUrlDto,
  UploadDto,
} from "../types/upload.types.js";

export async function toUploadDto(
  record: UploadRecord,
  signedUrlExpiresInSeconds: number,
): Promise<UploadDto> {
  const signedUrl = await generateSignedDownloadUrl(
    record.s3Key,
    signedUrlExpiresInSeconds,
  );

  return {
    id: record.id,
    uploadType: record.uploadType,
    category: record.category,
    status: record.status,
    fileUrl: buildS3ObjectUrl(record.s3Key),
    signedUrl,
    mimeType: record.mimeType,
    originalName: record.originalName,
    size: record.size,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toFileMetadataDto(record: UploadRecord): FileMetadataDto {
  return {
    id: record.id,
    uploadType: record.uploadType,
    category: record.category,
    status: record.status,
    fileUrl: buildS3ObjectUrl(record.s3Key),
    mimeType: record.mimeType,
    originalName: record.originalName,
    size: record.size,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function toSignedUrlDto(
  record: UploadRecord,
  expiresInSeconds: number,
): Promise<SignedUrlDto> {
  const signedUrl = await generateSignedDownloadUrl(
    record.s3Key,
    expiresInSeconds,
  );

  return {
    id: record.id,
    signedUrl,
    expiresInSeconds,
  };
}
