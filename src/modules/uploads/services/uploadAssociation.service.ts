/**
 * uploads — uploadAssociation.service
 * Validates and resolves FileUpload records for domain associations.
 */
import { prisma } from "../../../infrastructure/prisma/client.js";
import { buildS3ObjectUrl } from "../../../infrastructure/s3/index.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import type { UploadTypeValue } from "../types/upload.types.js";
import { UploadService } from "./upload.service.js";

export interface ResolvedUploadAssociation {
  id: string;
  fileUrl: string;
  s3Key: string;
}

export class UploadAssociationService {
  private readonly uploadService = new UploadService();

  async storeFileForAssociation(
    actorUserId: string,
    actorRole: UserRole,
    uploadType: UploadTypeValue,
    file: Express.Multer.File,
  ): Promise<ResolvedUploadAssociation> {
    const upload = await this.uploadService.storeUploadedFile(
      actorUserId,
      actorRole,
      uploadType,
      file,
    );

    return {
      id: upload.id,
      fileUrl: buildS3ObjectUrl(upload.s3Key),
      s3Key: upload.s3Key,
    };
  }

  async assertUploadAvailableForAssociation(
    fileUploadId: string,
    actorUserId: string,
    actorRole: UserRole,
    expectedUploadType: UploadTypeValue,
  ): Promise<ResolvedUploadAssociation> {
    const upload = await prisma.fileUpload.findUnique({
      where: { id: fileUploadId },
    });

    if (!upload) {
      throw new NotFoundError("Upload not found");
    }

    if (upload.status !== "UPLOADED") {
      throw new ValidationError("Validation failed", [
        { field: "uploadId", message: "Upload is not available" },
      ]);
    }

    if (upload.uploadType !== expectedUploadType) {
      throw new ValidationError("Validation failed", [
        {
          field: "uploadId",
          message: `Upload type must be ${expectedUploadType}`,
        },
      ]);
    }

    if (actorRole !== UserRole.ADMIN && upload.userId !== actorUserId) {
      throw new ForbiddenError("You do not have access to this upload");
    }

    await this.assertUploadNotLinked(fileUploadId);

    return {
      id: upload.id,
      fileUrl: buildS3ObjectUrl(upload.s3Key),
      s3Key: upload.s3Key,
    };
  }

  async assertUploadNotLinked(fileUploadId: string): Promise<void> {
    const [media, document, proof] = await Promise.all([
      prisma.productMedia.findUnique({
        where: { fileUploadId },
        select: { id: true },
      }),
      prisma.productDocument.findUnique({
        where: { fileUploadId },
        select: { id: true },
      }),
      prisma.orderProof.findUnique({
        where: { fileUploadId },
        select: { id: true },
      }),
    ]);

    if (media || document || proof) {
      throw new ConflictError("Upload is already associated with another record");
    }
  }
}
