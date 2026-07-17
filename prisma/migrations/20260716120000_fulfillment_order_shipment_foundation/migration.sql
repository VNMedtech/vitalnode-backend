-- Fulfillment foundation: commerce OrderStatus rename + Shipment model
-- Maps in-flight orders per FULFILLMENT_REDESIGN.md §15.7

-- ---------------------------------------------------------------------------
-- 1. New enums
-- ---------------------------------------------------------------------------

CREATE TYPE "FulfillmentMethod" AS ENUM ('INTERNAL_DP', 'THIRD_PARTY');

CREATE TYPE "ShipmentBookingSource" AS ENUM ('MANUAL', 'API');

CREATE TYPE "ShipmentStatus" AS ENUM (
  'CREATED',
  'READY',
  'BOOKED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'CANCELLED'
);

-- ---------------------------------------------------------------------------
-- 2. Replace OrderStatus enum (rename + drop ASSIGNED_DELIVERY_PARTNER)
-- ---------------------------------------------------------------------------

CREATE TYPE "OrderStatus_new" AS ENUM (
  'PENDING_PAYMENT',
  'PAYMENT_FAILED',
  'PLACED',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'PENDING_SETTLEMENT',
  'SETTLED',
  'DELIVERY_FAILED',
  'CANCELLED',
  'REFUNDED'
);

ALTER TABLE "Order"
  ALTER COLUMN "orderStatus" TYPE "OrderStatus_new"
  USING (
    CASE "orderStatus"::text
      WHEN 'ASSIGNED_DELIVERY_PARTNER' THEN 'CONFIRMED'
      WHEN 'PROCESSING' THEN 'CONFIRMED'
      WHEN 'OUT_FOR_DELIVERY' THEN 'SHIPPED'
      ELSE "orderStatus"::text
    END
  )::"OrderStatus_new";

DROP TYPE "OrderStatus";

ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";

-- ---------------------------------------------------------------------------
-- 3. Shipment table
-- ---------------------------------------------------------------------------

CREATE TABLE "Shipment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "method" "FulfillmentMethod" NOT NULL,
  "bookingSource" "ShipmentBookingSource",
  "status" "ShipmentStatus" NOT NULL,
  "deliveryPartnerId" TEXT,
  "carrier" TEXT,
  "awbNumber" TEXT,
  "trackingUrl" TEXT,
  "labelUrl" TEXT,
  "externalShipmentId" TEXT,
  "bookedAt" TIMESTAMP(3),
  "shippedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

CREATE INDEX "Shipment_method_idx" ON "Shipment"("method");

CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

CREATE INDEX "Shipment_deliveryPartnerId_idx" ON "Shipment"("deliveryPartnerId");

CREATE INDEX "Shipment_awbNumber_idx" ON "Shipment"("awbNumber");

CREATE INDEX "Shipment_externalShipmentId_idx" ON "Shipment"("externalShipmentId");

ALTER TABLE "Shipment"
  ADD CONSTRAINT "Shipment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Shipment"
  ADD CONSTRAINT "Shipment_deliveryPartnerId_fkey"
  FOREIGN KEY ("deliveryPartnerId") REFERENCES "DeliveryPartnerProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Backfill shipments for in-flight / completed orders (§15.7)
--    Idempotent: skip orders that already have a Shipment row.
-- ---------------------------------------------------------------------------

-- Former ASSIGNED_DELIVERY_PARTNER / PROCESSING → CONFIRMED + INTERNAL_DP READY
INSERT INTO "Shipment" (
  "id",
  "orderId",
  "method",
  "bookingSource",
  "status",
  "deliveryPartnerId",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  o."id",
  'INTERNAL_DP'::"FulfillmentMethod",
  NULL,
  'READY'::"ShipmentStatus",
  o."deliveryPartnerId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Order" o
WHERE o."orderStatus" = 'CONFIRMED'
  AND NOT EXISTS (SELECT 1 FROM "Shipment" s WHERE s."orderId" = o."id");

-- Former OUT_FOR_DELIVERY → SHIPPED + INTERNAL_DP OUT_FOR_DELIVERY
INSERT INTO "Shipment" (
  "id",
  "orderId",
  "method",
  "bookingSource",
  "status",
  "deliveryPartnerId",
  "shippedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  o."id",
  'INTERNAL_DP'::"FulfillmentMethod",
  NULL,
  'OUT_FOR_DELIVERY'::"ShipmentStatus",
  o."deliveryPartnerId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Order" o
WHERE o."orderStatus" = 'SHIPPED'
  AND NOT EXISTS (SELECT 1 FROM "Shipment" s WHERE s."orderId" = o."id");

-- DELIVERED / PENDING_SETTLEMENT / SETTLED / DELIVERY_FAILED with partner → backfill
INSERT INTO "Shipment" (
  "id",
  "orderId",
  "method",
  "bookingSource",
  "status",
  "deliveryPartnerId",
  "shippedAt",
  "deliveredAt",
  "failureReason",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  o."id",
  'INTERNAL_DP'::"FulfillmentMethod",
  NULL,
  CASE
    WHEN o."orderStatus" = 'DELIVERY_FAILED' THEN 'FAILED'::"ShipmentStatus"
    ELSE 'DELIVERED'::"ShipmentStatus"
  END,
  o."deliveryPartnerId",
  COALESCE(o."deliveredAt", o."placedAt", o."createdAt"),
  CASE
    WHEN o."orderStatus" = 'DELIVERY_FAILED' THEN NULL
    ELSE o."deliveredAt"
  END,
  CASE
    WHEN o."orderStatus" = 'DELIVERY_FAILED' THEN 'Migrated from legacy delivery-failed order'
    ELSE NULL
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Order" o
WHERE o."orderStatus" IN (
    'DELIVERED',
    'PENDING_SETTLEMENT',
    'SETTLED',
    'DELIVERY_FAILED'
  )
  AND o."deliveryPartnerId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Shipment" s WHERE s."orderId" = o."id");
