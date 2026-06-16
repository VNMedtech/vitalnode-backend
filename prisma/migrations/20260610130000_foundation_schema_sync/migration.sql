-- Foundation schema sync: align database with prisma/schema.prisma

-- User.mustChangePassword (delivery partner first-login flow)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Idempotency keys for commerce retry safety
CREATE TYPE "IdempotencyKeyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE IF NOT EXISTS "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "requestHash" TEXT,
    "responseBody" JSONB,
    "status" "IdempotencyKeyStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyKey_actorUserId_key_route_key"
ON "IdempotencyKey"("actorUserId", "key", "route");

CREATE INDEX IF NOT EXISTS "IdempotencyKey_expiresAt_idx"
ON "IdempotencyKey"("expiresAt");

ALTER TABLE "IdempotencyKey" DROP CONSTRAINT IF EXISTS "IdempotencyKey_actorUserId_fkey";
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Webhook event deduplication
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_provider_eventId_key"
ON "WebhookEvent"("provider", "eventId");

CREATE INDEX IF NOT EXISTS "WebhookEvent_eventType_idx"
ON "WebhookEvent"("eventType");

CREATE INDEX IF NOT EXISTS "WebhookEvent_createdAt_idx"
ON "WebhookEvent"("createdAt");

-- Payment natural-key uniqueness (idempotent fulfillment)
DROP INDEX IF EXISTS "Payment_razorpayOrderId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_razorpayOrderId_key"
ON "Payment"("razorpayOrderId");

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_razorpayPaymentId_key"
ON "Payment"("razorpayPaymentId");
