-- Layer 5: Inventory movement deduplication for commerce workflows.
-- Prevents duplicate ORDER_DEDUCTION / ORDER_RESTORE rows for the same order line
-- under concurrent webhooks, retries, or duplicate transaction execution.
-- Manual movements (referenceId IS NULL) remain unaffected — PostgreSQL treats
-- each NULL referenceId as distinct in unique constraints.

CREATE UNIQUE INDEX "InventoryMovement_order_dedupe_key"
ON "InventoryMovement" ("referenceId", "productId", "movementType");
