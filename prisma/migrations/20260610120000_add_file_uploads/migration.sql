-- CreateEnum
CREATE TYPE "UploadCategory" AS ENUM ('IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('UPLOADING', 'UPLOADED', 'FAILED');

-- CreateTable
CREATE TABLE "FileUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "UploadCategory" NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'UPLOADING',
    "s3Key" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileUpload_s3Key_key" ON "FileUpload"("s3Key");

-- CreateIndex
CREATE INDEX "FileUpload_userId_idx" ON "FileUpload"("userId");

-- CreateIndex
CREATE INDEX "FileUpload_category_idx" ON "FileUpload"("category");

-- CreateIndex
CREATE INDEX "FileUpload_status_idx" ON "FileUpload"("status");

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
