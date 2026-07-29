-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "readAt" TIMESTAMP(3);

-- Backfill: existing read rows use updatedAt as the best available read timestamp
UPDATE "Notification" SET "readAt" = "updatedAt" WHERE "isRead" = true;

-- CreateIndex
CREATE INDEX "Notification_isRead_readAt_idx" ON "Notification"("isRead", "readAt");
