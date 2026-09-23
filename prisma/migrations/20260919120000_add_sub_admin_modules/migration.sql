-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUB_ADMIN';

-- CreateEnum
CREATE TYPE "AdminModule" AS ENUM (
  'USERS',
  'PRODUCTS_APPROVE',
  'PRODUCTS_MANAGE',
  'TEMPLATES',
  'ORDERS',
  'SETTLEMENTS',
  'INVENTORY',
  'CATEGORIES',
  'REVIEWS',
  'DP_REVIEWS',
  'AUDIT',
  'REPORTS'
);

-- CreateTable
CREATE TABLE "SubAdminModulePermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" "AdminModule" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubAdminModulePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubAdminModulePermission_userId_idx" ON "SubAdminModulePermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubAdminModulePermission_userId_module_key" ON "SubAdminModulePermission"("userId", "module");

-- AddForeignKey
ALTER TABLE "SubAdminModulePermission" ADD CONSTRAINT "SubAdminModulePermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
