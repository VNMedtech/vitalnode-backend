import { z } from "zod";
import {
  PRODUCT_BRAND_MAX_LENGTH,
  PRODUCT_COLOR_MAX_LENGTH,
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_DETAILS_MAX_LENGTH,
  PRODUCT_MAX_DOCUMENTS,
  PRODUCT_MAX_MEDIA,
  PRODUCT_MODEL_MAX_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_TYPE_MAX_LENGTH,
} from "../constants/product.constants.js";

const decimalInputSchema = z
  .union([
    z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal with up to 2 places"),
    z.number().finite().nonnegative(),
  ])
  .transform((value) => (typeof value === "number" ? value.toString() : value));

const positiveDecimalInputSchema = decimalInputSchema.refine(
  (value) => Number(value) > 0,
  "Must be greater than zero",
);

const productMediaSchema = z
  .object({
    fileUrl: z.string().trim().url("Invalid media file URL"),
    displayOrder: z.number().int().min(0).optional(),
  })
  .strict();

const productDocumentSchema = z
  .object({
    fileUrl: z.string().trim().url("Invalid document file URL"),
    documentType: z.string().trim().min(1).max(120),
  })
  .strict();

export const createProductBodySchema = z
  .object({
    categoryId: z.string().uuid("Invalid category ID"),
    productName: z
      .string()
      .trim()
      .min(1, "Product name is required")
      .max(PRODUCT_NAME_MAX_LENGTH),
    brand: z
      .string()
      .trim()
      .min(1, "Brand is required")
      .max(PRODUCT_BRAND_MAX_LENGTH),
    model: z
      .string()
      .trim()
      .min(1, "Model is required")
      .max(PRODUCT_MODEL_MAX_LENGTH),
    productType: z
      .string()
      .trim()
      .min(1, "Product type is required")
      .max(PRODUCT_TYPE_MAX_LENGTH),
    color: z.string().trim().min(1).max(PRODUCT_COLOR_MAX_LENGTH).optional(),
    weight: decimalInputSchema.optional(),
    length: decimalInputSchema.optional(),
    warrantyPeriod: z.number().int().min(0).optional(),
    returnTime: z.number().int().min(0).optional(),
    deliveryTime: z.number().int().min(0).optional(),
    pricing: positiveDecimalInputSchema,
    moq: z.number().int().min(1, "MOQ must be at least 1"),
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(PRODUCT_DESCRIPTION_MAX_LENGTH),
    details: z.string().trim().max(PRODUCT_DETAILS_MAX_LENGTH).optional(),
    specifications: z.record(z.string(), z.unknown()).optional(),
    media: z.array(productMediaSchema).max(PRODUCT_MAX_MEDIA).optional(),
    documents: z
      .array(productDocumentSchema)
      .max(PRODUCT_MAX_DOCUMENTS)
      .optional(),
  })
  .strict();

export type CreateProductBody = z.infer<typeof createProductBodySchema>;
