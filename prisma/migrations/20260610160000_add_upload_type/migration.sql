-- Add UploadType enum and column to FileUpload (schema drift fix)

DO $$ BEGIN
  CREATE TYPE "UploadType" AS ENUM (
    'PRODUCT_IMAGE',
    'PRODUCT_DOCUMENT',
    'HANDOVER_PROOF',
    'DELIVERY_PROOF',
    'PROFILE_IMAGE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "FileUpload"
ADD COLUMN IF NOT EXISTS "uploadType" "UploadType" NOT NULL DEFAULT 'PRODUCT_IMAGE';

CREATE INDEX IF NOT EXISTS "FileUpload_uploadType_idx" ON "FileUpload"("uploadType");
