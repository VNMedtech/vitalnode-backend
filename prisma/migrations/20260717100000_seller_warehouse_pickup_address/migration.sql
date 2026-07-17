-- CreateTable
CREATE TABLE "SellerAddress" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SellerAddress_sellerId_idx" ON "SellerAddress"("sellerId");

-- CreateIndex
CREATE INDEX "SellerAddress_isActive_idx" ON "SellerAddress"("isActive");

-- CreateIndex
CREATE INDEX "SellerAddress_isDefault_idx" ON "SellerAddress"("isDefault");

-- AddForeignKey
ALTER TABLE "SellerAddress" ADD CONSTRAINT "SellerAddress_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "pickupAddressId" TEXT;
ALTER TABLE "Order" ADD COLUMN "pickupAddressSnapshot" JSONB;

-- CreateIndex
CREATE INDEX "Order_pickupAddressId_idx" ON "Order"("pickupAddressId");

-- Backfill one default warehouse per seller from SellerProfile address fields
INSERT INTO "SellerAddress" (
  "id",
  "sellerId",
  "label",
  "contactPerson",
  "phone",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "country",
  "postalCode",
  "latitude",
  "longitude",
  "isDefault",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  sp."id",
  'Primary warehouse',
  sp."contactPerson",
  NULL,
  sp."addressLine1",
  sp."addressLine2",
  sp."city",
  sp."state",
  sp."country",
  sp."postalCode",
  sp."latitude",
  sp."longitude",
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "SellerProfile" sp
WHERE NOT EXISTS (
  SELECT 1 FROM "SellerAddress" sa WHERE sa."sellerId" = sp."id"
);

-- Backfill existing orders with seller default warehouse snapshot
UPDATE "Order" o
SET
  "pickupAddressId" = sa."id",
  "pickupAddressSnapshot" = jsonb_build_object(
    'id', sa."id",
    'label', sa."label",
    'contactPerson', sa."contactPerson",
    'phone', sa."phone",
    'addressLine1', sa."addressLine1",
    'addressLine2', sa."addressLine2",
    'city', sa."city",
    'state', sa."state",
    'country', sa."country",
    'postalCode', sa."postalCode",
    'latitude', CASE WHEN sa."latitude" IS NULL THEN NULL ELSE sa."latitude"::text END,
    'longitude', CASE WHEN sa."longitude" IS NULL THEN NULL ELSE sa."longitude"::text END
  )
FROM "SellerAddress" sa
WHERE o."sellerId" = sa."sellerId"
  AND sa."isDefault" = true
  AND o."pickupAddressId" IS NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pickupAddressId_fkey" FOREIGN KEY ("pickupAddressId") REFERENCES "SellerAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
