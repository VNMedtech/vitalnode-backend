-- Product templates + multi-category products
-- Backfills existing products into ProductCategory and attributes JSON.

-- CreateEnum
CREATE TYPE "ProductTemplateFieldType" AS ENUM (
  'TEXT',
  'NUMBER',
  'BOOLEAN',
  'SELECT',
  'MULTISELECT',
  'DATE'
);

-- CreateTable: ProductTemplate
CREATE TABLE "ProductTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProductTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductTemplate_name_key" ON "ProductTemplate"("name");
CREATE INDEX "ProductTemplate_isActive_idx" ON "ProductTemplate"("isActive");
CREATE INDEX "ProductTemplate_deletedAt_idx" ON "ProductTemplate"("deletedAt");

-- CreateTable: ProductTemplateField
CREATE TABLE "ProductTemplateField" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "ProductTemplateFieldType" NOT NULL,
    "options" JSONB,
    "defaultValue" JSONB,
    "unit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTemplateField_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductTemplateField_templateId_idx" ON "ProductTemplateField"("templateId");
CREATE UNIQUE INDEX "ProductTemplateField_templateId_key_key" ON "ProductTemplateField"("templateId", "key");

ALTER TABLE "ProductTemplateField"
  ADD CONSTRAINT "ProductTemplateField_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ProductTemplate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ProductTemplateCategory
CREATE TABLE "ProductTemplateCategory" (
    "templateId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "ProductTemplateCategory_pkey" PRIMARY KEY ("templateId", "categoryId")
);

CREATE INDEX "ProductTemplateCategory_categoryId_idx" ON "ProductTemplateCategory"("categoryId");

ALTER TABLE "ProductTemplateCategory"
  ADD CONSTRAINT "ProductTemplateCategory_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ProductTemplate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductTemplateCategory"
  ADD CONSTRAINT "ProductTemplateCategory_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: ProductCategory
CREATE TABLE "ProductCategory" (
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId", "categoryId")
);

CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");
CREATE INDEX "ProductCategory_productId_isPrimary_idx" ON "ProductCategory"("productId", "isPrimary");

ALTER TABLE "ProductCategory"
  ADD CONSTRAINT "ProductCategory_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductCategory"
  ADD CONSTRAINT "ProductCategory_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add new Product columns before dropping old ones
ALTER TABLE "Product"
  ADD COLUMN "templateId" TEXT,
  ADD COLUMN "attributes" JSONB;

-- Backfill ProductCategory from legacy categoryId
INSERT INTO "ProductCategory" ("productId", "categoryId", "isPrimary")
SELECT "id", "categoryId", true
FROM "Product"
WHERE "categoryId" IS NOT NULL;

-- Fold legacy columns + specifications into attributes
UPDATE "Product"
SET "attributes" = COALESCE(
  (
    SELECT jsonb_strip_nulls(
      jsonb_build_object(
        'productType', to_jsonb("productType"),
        'color', to_jsonb("color"),
        'weight', to_jsonb("weight"),
        'length', to_jsonb("length"),
        'warrantyPeriod', to_jsonb("warrantyPeriod"),
        'returnTime', to_jsonb("returnTime"),
        'deliveryTime', to_jsonb("deliveryTime")
      )
      || CASE
        WHEN "specifications" IS NOT NULL
          AND jsonb_typeof("specifications"::jsonb) = 'object'
        THEN "specifications"::jsonb
        ELSE '{}'::jsonb
      END
    )
  ),
  '{}'::jsonb
);

-- Drop legacy FK + index + columns
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_categoryId_fkey";
DROP INDEX IF EXISTS "Product_categoryId_idx";

ALTER TABLE "Product"
  DROP COLUMN "categoryId",
  DROP COLUMN "productType",
  DROP COLUMN "color",
  DROP COLUMN "weight",
  DROP COLUMN "length",
  DROP COLUMN "warrantyPeriod",
  DROP COLUMN "returnTime",
  DROP COLUMN "deliveryTime",
  DROP COLUMN "specifications";

-- Add template FK + index
CREATE INDEX "Product_templateId_idx" ON "Product"("templateId");

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ProductTemplate"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
