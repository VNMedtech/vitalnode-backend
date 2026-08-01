-- CreateEnum
CREATE TYPE "DeliveryPartnerCommentStatus" AS ENUM ('PENDING', 'APPROVED', 'DISABLED');

-- CreateTable
CREATE TABLE "DeliveryPartnerReview" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "deliveryPartnerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "commentStatus" "DeliveryPartnerCommentStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryPartnerReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPartnerReview_orderId_key" ON "DeliveryPartnerReview"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryPartnerReview_deliveryPartnerId_idx" ON "DeliveryPartnerReview"("deliveryPartnerId");

-- CreateIndex
CREATE INDEX "DeliveryPartnerReview_buyerId_idx" ON "DeliveryPartnerReview"("buyerId");

-- CreateIndex
CREATE INDEX "DeliveryPartnerReview_commentStatus_idx" ON "DeliveryPartnerReview"("commentStatus");

-- AddForeignKey
ALTER TABLE "DeliveryPartnerReview" ADD CONSTRAINT "DeliveryPartnerReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryPartnerReview" ADD CONSTRAINT "DeliveryPartnerReview_deliveryPartnerId_fkey" FOREIGN KEY ("deliveryPartnerId") REFERENCES "DeliveryPartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryPartnerReview" ADD CONSTRAINT "DeliveryPartnerReview_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "BuyerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
