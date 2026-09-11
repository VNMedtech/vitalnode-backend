-- CreateEnum
CREATE TYPE "DeliveryAttemptStatus" AS ENUM ('IN_PROGRESS', 'DELIVERED', 'FAILED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "DeliveryAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "method" "FulfillmentMethod" NOT NULL,
    "deliveryPartnerId" TEXT,
    "carrier" TEXT,
    "awb" TEXT,
    "trackingUrl" TEXT,
    "status" "DeliveryAttemptStatus" NOT NULL,
    "failureReason" TEXT,
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryAttempt_orderId_idx" ON "DeliveryAttempt"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryAttempt_status_idx" ON "DeliveryAttempt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAttempt_orderId_attemptNumber_key" ON "DeliveryAttempt"("orderId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_deliveryPartnerId_fkey" FOREIGN KEY ("deliveryPartnerId") REFERENCES "DeliveryPartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill attempt #1 for existing shipped / failed / delivered orders with a Shipment
INSERT INTO "DeliveryAttempt" (
    "id",
    "orderId",
    "attemptNumber",
    "method",
    "deliveryPartnerId",
    "carrier",
    "awb",
    "trackingUrl",
    "status",
    "failureReason",
    "failedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    s."orderId",
    1,
    s."method",
    s."deliveryPartnerId",
    s."carrier",
    s."awbNumber",
    s."trackingUrl",
    CASE
        WHEN o."orderStatus" = 'DELIVERY_FAILED' THEN 'FAILED'::"DeliveryAttemptStatus"
        WHEN o."orderStatus" IN ('DELIVERED', 'PENDING_SETTLEMENT', 'SETTLED') THEN 'DELIVERED'::"DeliveryAttemptStatus"
        ELSE 'IN_PROGRESS'::"DeliveryAttemptStatus"
    END,
    CASE
        WHEN o."orderStatus" = 'DELIVERY_FAILED' THEN s."failureReason"
        ELSE NULL
    END,
    CASE
        WHEN o."orderStatus" = 'DELIVERY_FAILED' THEN COALESCE(s."updatedAt", NOW())
        ELSE NULL
    END,
    COALESCE(s."shippedAt", s."createdAt", NOW()),
    NOW()
FROM "Shipment" s
INNER JOIN "Order" o ON o."id" = s."orderId"
WHERE o."orderStatus" IN (
    'SHIPPED',
    'DELIVERY_FAILED',
    'DELIVERED',
    'PENDING_SETTLEMENT',
    'SETTLED'
)
AND NOT EXISTS (
    SELECT 1 FROM "DeliveryAttempt" da WHERE da."orderId" = s."orderId"
);
