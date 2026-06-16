-- Enforce one proof per type per order (prevents concurrent upload races).
CREATE UNIQUE INDEX "OrderProof_orderId_proofType_key" ON "OrderProof"("orderId", "proofType");
