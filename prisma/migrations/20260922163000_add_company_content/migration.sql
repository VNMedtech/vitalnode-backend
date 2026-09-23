-- AlterEnum
ALTER TYPE "AdminModule" ADD VALUE 'COMPANY_CONTENT';

-- AlterEnum
ALTER TYPE "UploadType" ADD VALUE 'COMPANY_IMAGE';

-- CreateEnum
CREATE TYPE "CompanyMemberType" AS ENUM ('FOUNDER', 'TEAM');

-- CreateTable
CREATE TABLE "WhyVitalnodeSection" (
    "id" TEXT NOT NULL DEFAULT 'why-vitalnode',
    "title" TEXT NOT NULL DEFAULT 'Why Vitalnode',
    "subtitle" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhyVitalnodeSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhyVitalnodeCard" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WhyVitalnodeCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL,
    "type" "CompanyMemberType" NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "bio" TEXT,
    "imageUrl" TEXT,
    "imageUploadId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhyVitalnodeCard_sectionId_sortOrder_idx" ON "WhyVitalnodeCard"("sectionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_imageUploadId_key" ON "CompanyMember"("imageUploadId");

-- CreateIndex
CREATE INDEX "CompanyMember_type_isActive_sortOrder_idx" ON "CompanyMember"("type", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "CompanyMember_deletedAt_idx" ON "CompanyMember"("deletedAt");

-- AddForeignKey
ALTER TABLE "WhyVitalnodeCard" ADD CONSTRAINT "WhyVitalnodeCard_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "WhyVitalnodeSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_imageUploadId_fkey" FOREIGN KEY ("imageUploadId") REFERENCES "FileUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed singleton Why Vitalnode section
INSERT INTO "WhyVitalnodeSection" ("id", "title", "subtitle", "isPublished", "updatedAt", "createdAt")
VALUES ('why-vitalnode', 'Why Vitalnode', 'Trusted medical equipment procurement for modern healthcare teams.', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
