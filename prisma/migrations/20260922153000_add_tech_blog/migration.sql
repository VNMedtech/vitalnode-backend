-- AlterEnum AdminModule
ALTER TYPE "AdminModule" ADD VALUE 'TECH_BLOG';

-- AlterEnum UploadCategory
ALTER TYPE "UploadCategory" ADD VALUE 'VIDEO';

-- AlterEnum UploadType
ALTER TYPE "UploadType" ADD VALUE 'BLOG_IMAGE';
ALTER TYPE "UploadType" ADD VALUE 'BLOG_VIDEO';

-- CreateEnum
CREATE TYPE "TechBlogStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "TechBlog" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featuredImageUrl" TEXT,
    "featuredImageUploadId" TEXT,
    "content" TEXT NOT NULL,
    "publishDate" TIMESTAMP(3),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "TechBlogStatus" NOT NULL DEFAULT 'DRAFT',
    "authorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TechBlog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TechBlog_slug_key" ON "TechBlog"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TechBlog_featuredImageUploadId_key" ON "TechBlog"("featuredImageUploadId");

-- CreateIndex
CREATE INDEX "TechBlog_status_idx" ON "TechBlog"("status");

-- CreateIndex
CREATE INDEX "TechBlog_category_idx" ON "TechBlog"("category");

-- CreateIndex
CREATE INDEX "TechBlog_isFeatured_idx" ON "TechBlog"("isFeatured");

-- CreateIndex
CREATE INDEX "TechBlog_publishDate_idx" ON "TechBlog"("publishDate");

-- CreateIndex
CREATE INDEX "TechBlog_deletedAt_idx" ON "TechBlog"("deletedAt");

-- CreateIndex
CREATE INDEX "TechBlog_authorUserId_idx" ON "TechBlog"("authorUserId");

-- AddForeignKey
ALTER TABLE "TechBlog" ADD CONSTRAINT "TechBlog_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechBlog" ADD CONSTRAINT "TechBlog_featuredImageUploadId_fkey" FOREIGN KEY ("featuredImageUploadId") REFERENCES "FileUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
