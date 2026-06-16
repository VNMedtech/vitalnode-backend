/**
 * uploads — upload.service
 * Business logic, state transitions, permissions, and orchestration.
 */
import { env } from "../../../config/env.js";
import {
  deleteObjectFromS3,
  uploadObjectToS3,
} from "../../../infrastructure/s3/index.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import {
  UPLOAD_ACTIONS,
  UPLOAD_AUDIT_ENTITY_TYPE,
} from "../constants/upload.constants.js";
import {
  toFileMetadataDto,
  toSignedUrlDto,
  toUploadDto,
} from "../dto/upload.dto.js";
import { UploadRepository } from "../repositories/upload.repository.js";
import type {
  DeleteUploadResult,
  FileMetadataDto,
  SignedUrlDto,
  UploadDto,
  UploadTypeValue,
} from "../types/upload.types.js";
import { validateUploadFile } from "../utils/fileValidation.util.js";
import { buildSecureS3Key } from "../utils/secureFileName.util.js";
import {
  assertUploadTypeAllowedForRole,
  resolveUploadCategory,
} from "../utils/uploadTypeAccess.util.js";

function assertCanAccessUpload(
  actorUserId: string,
  actorRole: UserRole,
  ownerUserId: string,
): void {
  if (actorRole === UserRole.ADMIN) {
    return;
  }

  if (actorUserId !== ownerUserId) {
    throw new ForbiddenError("You do not have access to this upload");
  }
}

export class UploadService {
  private readonly repo = new UploadRepository(prisma);

  async uploadImage(
    actorUserId: string,
    actorRole: UserRole,
    uploadType: UploadTypeValue,
    file: Express.Multer.File | undefined,
  ): Promise<UploadDto> {
    assertUploadTypeAllowedForRole(uploadType, actorRole);
    const category = resolveUploadCategory(uploadType);
    return this.createUpload(actorUserId, uploadType, category, file);
  }

  async uploadDocument(
    actorUserId: string,
    actorRole: UserRole,
    uploadType: UploadTypeValue,
    file: Express.Multer.File | undefined,
  ): Promise<UploadDto> {
    assertUploadTypeAllowedForRole(uploadType, actorRole);
    const category = resolveUploadCategory(uploadType);
    return this.createUpload(actorUserId, uploadType, category, file);
  }

  async getFileMetadata(
    actorUserId: string,
    actorRole: UserRole,
    uploadId: string,
  ): Promise<FileMetadataDto> {
    const existing = await this.repo.findById(uploadId);
    if (!existing) {
      throw new NotFoundError("Upload not found");
    }

    assertCanAccessUpload(actorUserId, actorRole, existing.userId);

    return toFileMetadataDto(existing);
  }

  async replaceUpload(
    actorUserId: string,
    actorRole: UserRole,
    uploadId: string,
    file: Express.Multer.File | undefined,
  ): Promise<UploadDto> {
    const existing = await this.repo.findById(uploadId);
    if (!existing) {
      throw new NotFoundError("Upload not found");
    }

    assertCanAccessUpload(actorUserId, actorRole, existing.userId);
    assertUploadTypeAllowedForRole(existing.uploadType, actorRole);

    const validatedFile = validateUploadFile(file, existing.category);
    const previousKey = existing.s3Key;
    const nextKey = buildSecureS3Key(
      existing.uploadType,
      validatedFile.extension,
    );

    const updated = await this.repo.update(uploadId, {
      status: "UPLOADING",
      s3Key: nextKey,
      bucket: env.aws.bucketName,
      mimeType: validatedFile.mimeType,
      originalName: validatedFile.originalName,
      size: validatedFile.size,
    });

    try {
      const uploadResult = await uploadObjectToS3({
        key: nextKey,
        body: validatedFile.buffer,
        contentType: validatedFile.mimeType,
        contentLength: validatedFile.size,
      });

      const completed = await this.repo.update(uploadId, {
        status: "UPLOADED",
        bucket: uploadResult.bucket,
      });

      await deleteObjectFromS3(previousKey);

      auditLogger.log({
        actorUserId,
        action: UPLOAD_ACTIONS.REPLACE,
        entityType: UPLOAD_AUDIT_ENTITY_TYPE,
        entityId: completed.id,
        metadata: {
          uploadType: completed.uploadType,
          category: completed.category,
          previousKey,
          nextKey: completed.s3Key,
          size: completed.size,
        },
      });

      return toUploadDto(completed, env.aws.signedUrlExpiresInSeconds);
    } catch (error) {
      await this.repo.update(uploadId, {
        status: "FAILED",
        s3Key: previousKey,
        bucket: existing.bucket,
        mimeType: existing.mimeType,
        originalName: existing.originalName,
        size: existing.size,
      });

      try {
        await deleteObjectFromS3(nextKey);
      } catch {
        // Best-effort cleanup for a failed replacement attempt.
      }

      throw error;
    }
  }

  async deleteUpload(
    actorUserId: string,
    actorRole: UserRole,
    uploadId: string,
  ): Promise<DeleteUploadResult> {
    const existing = await this.repo.findById(uploadId);
    if (!existing) {
      throw new NotFoundError("Upload not found");
    }

    assertCanAccessUpload(actorUserId, actorRole, existing.userId);

    await deleteObjectFromS3(existing.s3Key);
    await this.repo.delete(uploadId);

    auditLogger.log({
      actorUserId,
      action: UPLOAD_ACTIONS.DELETE,
      entityType: UPLOAD_AUDIT_ENTITY_TYPE,
      entityId: existing.id,
      metadata: {
        uploadType: existing.uploadType,
        category: existing.category,
        s3Key: existing.s3Key,
      },
    });

    return {
      id: existing.id,
      deleted: true,
    };
  }

  async getSignedUrl(
    actorUserId: string,
    actorRole: UserRole,
    uploadId: string,
    expiresInSeconds?: number,
  ): Promise<SignedUrlDto> {
    const existing = await this.repo.findById(uploadId);
    if (!existing) {
      throw new NotFoundError("Upload not found");
    }

    if (existing.status !== "UPLOADED") {
      throw new ValidationError("Validation failed", [
        {
          field: "id",
          message: "Upload is not available",
        },
      ]);
    }

    assertCanAccessUpload(actorUserId, actorRole, existing.userId);

    const resolvedExpiresIn =
      expiresInSeconds ?? env.aws.signedUrlExpiresInSeconds;

    return toSignedUrlDto(existing, resolvedExpiresIn);
  }

  private async createUpload(
    actorUserId: string,
    uploadType: UploadTypeValue,
    category: ReturnType<typeof resolveUploadCategory>,
    file: Express.Multer.File | undefined,
  ): Promise<UploadDto> {
    const validatedFile = validateUploadFile(file, category);
    const s3Key = buildSecureS3Key(uploadType, validatedFile.extension);

    const created = await this.repo.create({
      userId: actorUserId,
      uploadType,
      category,
      status: "UPLOADING",
      s3Key,
      bucket: env.aws.bucketName,
      mimeType: validatedFile.mimeType,
      originalName: validatedFile.originalName,
      size: validatedFile.size,
    });

    try {
      const uploadResult = await uploadObjectToS3({
        key: s3Key,
        body: validatedFile.buffer,
        contentType: validatedFile.mimeType,
        contentLength: validatedFile.size,
      });

      const completed = await this.repo.update(created.id, {
        status: "UPLOADED",
        bucket: uploadResult.bucket,
      });

      auditLogger.log({
        actorUserId,
        action: UPLOAD_ACTIONS.CREATE,
        entityType: UPLOAD_AUDIT_ENTITY_TYPE,
        entityId: completed.id,
        metadata: {
          uploadType: completed.uploadType,
          category: completed.category,
          s3Key: completed.s3Key,
          size: completed.size,
        },
      });

      return toUploadDto(completed, env.aws.signedUrlExpiresInSeconds);
    } catch (error) {
      await this.repo.update(created.id, { status: "FAILED" });

      try {
        await deleteObjectFromS3(s3Key);
      } catch {
        // Best-effort cleanup for a failed upload attempt.
      }

      throw error;
    }
  }
}
