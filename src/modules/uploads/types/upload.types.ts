/**
 * uploads — upload.types
 * Module-specific TypeScript types and interfaces.
 */
import type {
  UploadCategory,
  UploadStatus,
  UploadType,
} from "../../../../generated/prisma/client.js";

export type UploadCategoryType = UploadCategory;
export type UploadStatusType = UploadStatus;
export type UploadTypeValue = UploadType;

export interface UploadDto {
  id: string;
  uploadType: UploadTypeValue;
  category: UploadCategoryType;
  status: UploadStatusType;
  fileUrl: string;
  signedUrl: string;
  mimeType: string;
  originalName: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export interface FileMetadataDto {
  id: string;
  uploadType: UploadTypeValue;
  category: UploadCategoryType;
  status: UploadStatusType;
  fileUrl: string;
  mimeType: string;
  originalName: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export interface SignedUrlDto {
  id: string;
  signedUrl: string;
  expiresInSeconds: number;
}

export interface DeleteUploadResult {
  id: string;
  deleted: true;
}
