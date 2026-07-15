-- AlterTable
ALTER TABLE "BuyerProfile" ADD COLUMN "nmcRegistrationNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BuyerProfile_nmcRegistrationNumber_key" ON "BuyerProfile"("nmcRegistrationNumber");
