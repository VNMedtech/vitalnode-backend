-- Remove redundant non-unique index superseded by Payment_razorpayPaymentId_key (foundation_schema_sync)
DROP INDEX IF EXISTS "Payment_razorpayPaymentId_idx";
