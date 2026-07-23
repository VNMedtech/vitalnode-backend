import { z } from "zod";
import {
  PRODUCT_BRAND_MAX_LENGTH,
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_DETAILS_MAX_LENGTH,
  PRODUCT_MIN_CATEGORIES,
  PRODUCT_MODEL_MAX_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
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

export const createProductBodySchema = z
  .object({
    categoryIds: z
      .array(z.string().uuid("Invalid category ID"))
      .min(PRODUCT_MIN_CATEGORIES, "At least one category is required"),
    templateId: z.string().uuid("Invalid template ID").optional(),
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
    pricing: positiveDecimalInputSchema,
    moq: z.number().int().min(1, "MOQ must be at least 1"),
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(PRODUCT_DESCRIPTION_MAX_LENGTH),
    details: z.string().trim().max(PRODUCT_DETAILS_MAX_LENGTH).optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type CreateProductBody = z.infer<typeof createProductBodySchema>;
