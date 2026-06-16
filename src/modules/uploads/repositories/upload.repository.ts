/**
 * uploads — upload.repository
 * Prisma data access — queries only, no business rules.
 */
import type {
  Prisma,
  PrismaClient,
  UploadCategory,
  UploadStatus,
  UploadType,
} from "../../../../generated/prisma/client.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

const uploadSelect = {
  id: true,
  userId: true,
  uploadType: true,
  category: true,
  status: true,
  s3Key: true,
  bucket: true,
  mimeType: true,
  originalName: true,
  size: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FileUploadSelect;

export type UploadRecord = Prisma.FileUploadGetPayload<{
  select: typeof uploadSelect;
}>;

export interface CreateUploadRecordInput {
  userId: string;
  uploadType: UploadType;
  category: UploadCategory;
  status?: UploadStatus;
  s3Key: string;
  bucket: string;
  mimeType: string;
  originalName: string;
  size: number;
}

export interface UpdateUploadRecordInput {
  status?: UploadStatus;
  s3Key?: string;
  bucket?: string;
  mimeType?: string;
  originalName?: string;
  size?: number;
}

export class UploadRepository {
  constructor(private readonly db: DbClient) {}

  create(input: CreateUploadRecordInput) {
    return this.db.fileUpload.create({
      data: {
        userId: input.userId,
        uploadType: input.uploadType,
        category: input.category,
        status: input.status ?? "UPLOADING",
        s3Key: input.s3Key,
        bucket: input.bucket,
        mimeType: input.mimeType,
        originalName: input.originalName,
        size: input.size,
      },
      select: uploadSelect,
    });
  }

  findById(id: string) {
    return this.db.fileUpload.findUnique({
      where: { id },
      select: uploadSelect,
    });
  }

  update(id: string, input: UpdateUploadRecordInput) {
    return this.db.fileUpload.update({
      where: { id },
      data: input,
      select: uploadSelect,
    });
  }

  delete(id: string) {
    return this.db.fileUpload.delete({
      where: { id },
      select: uploadSelect,
    });
  }
}
