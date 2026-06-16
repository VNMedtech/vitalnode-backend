-- Inventory movement tracking: actor, before/after quantities, reason, extended movement types.

ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'MANUAL_ADJUSTMENT';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'ORDER_CANCELLATION';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'REFUND_RESTORATION';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'SYSTEM_CORRECTION';

ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "actorUserId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "quantityBefore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "quantityAfter" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "quantityChanged" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "reason" TEXT;

-- Best-effort backfill for existing rows
UPDATE "InventoryMovement"
SET
  "quantityChanged" = CASE
    WHEN "movementType" = 'MANUAL_DECREASE' THEN -"quantity"
    ELSE "quantity"
  END,
  "quantityAfter" = "quantity",
  "reason" = "notes"
WHERE "quantityBefore" = 0 AND "quantityAfter" = 0 AND "quantityChanged" = 0;

ALTER TABLE "InventoryMovement"
ADD CONSTRAINT "InventoryMovement_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "InventoryMovement_actorUserId_idx" ON "InventoryMovement"("actorUserId");
