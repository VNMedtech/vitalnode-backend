-- Commission and settlement management

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_SETTLEMENT';
ALTER TYPE "OrderStatus" ADD VALUE 'SETTLED';

-- CreateEnum
CREATE TYPE "SettlementBatchStatus" AS ENUM ('PENDING', 'DISBURSED');

-- AlterTable
ALTER TABLE "SellerProfile" ADD COLUMN "commissionPercentage" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "grossAmount" DECIMAL(12,2),
ADD COLUMN "commissionPercentageSnapshot" DECIMAL(5,2),
ADD COLUMN "commissionAmount" DECIMAL(12,2),
ADD COLUMN "sellerReceivableAmount" DECIMAL(12,2),
ADD COLUMN "settlementBatchId" TEXT;

-- CreateTable
CREATE TABLE "SettlementBatch" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "status" "SettlementBatchStatus" NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "paymentReference" TEXT,
    "remarks" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SettlementBatch_batchNumber_key" ON "SettlementBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "SettlementBatch_sellerId_idx" ON "SettlementBatch"("sellerId");

-- CreateIndex
CREATE INDEX "SettlementBatch_status_idx" ON "SettlementBatch"("status");

-- CreateIndex
CREATE INDEX "SettlementBatch_createdAt_idx" ON "SettlementBatch"("createdAt");

-- CreateIndex
CREATE INDEX "SettlementBatch_disbursedAt_idx" ON "SettlementBatch"("disbursedAt");

-- CreateIndex
CREATE INDEX "SettlementBatch_createdByAdminId_idx" ON "SettlementBatch"("createdByAdminId");

-- CreateIndex
CREATE INDEX "Order_settlementBatchId_idx" ON "Order"("settlementBatchId");

-- CreateIndex
CREATE INDEX "Order_deliveredAt_idx" ON "Order"("deliveredAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_settlementBatchId_fkey" FOREIGN KEY ("settlementBatchId") REFERENCES "SettlementBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementBatch" ADD CONSTRAINT "SettlementBatch_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementBatch" ADD CONSTRAINT "SettlementBatch_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
