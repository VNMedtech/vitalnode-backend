-- AlterEnum
ALTER TYPE "AdminModule" ADD VALUE 'MARKETPLACE_TEASERS';

-- CreateEnum
CREATE TYPE "MarketplaceTeaserType" AS ENUM ('PRODUCT', 'UPDATE');

-- CreateTable
CREATE TABLE "MarketplaceTeaser" (
    "id" TEXT NOT NULL,
    "type" "MarketplaceTeaserType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imageUploadId" TEXT,
    "expectedAt" TIMESTAMP(3),
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceTeaser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceTeaser_type_isPublished_idx" ON "MarketplaceTeaser"("type", "isPublished");

-- CreateIndex
CREATE INDEX "MarketplaceTeaser_sortOrder_idx" ON "MarketplaceTeaser"("sortOrder");

-- CreateIndex
CREATE INDEX "MarketplaceTeaser_createdAt_idx" ON "MarketplaceTeaser"("createdAt");
