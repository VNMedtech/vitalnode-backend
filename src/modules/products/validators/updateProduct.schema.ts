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

export const updateProductBodySchema = z
  .object({
    categoryIds: z
      .array(z.string().uuid("Invalid category ID"))
      .min(PRODUCT_MIN_CATEGORIES)
      .optional(),
    templateId: z.string().uuid("Invalid template ID").nullable().optional(),
    productName: z
      .string()
      .trim()
      .min(1)
      .max(PRODUCT_NAME_MAX_LENGTH)
      .optional(),
    brand: z.string().trim().min(1).max(PRODUCT_BRAND_MAX_LENGTH).optional(),
    model: z.string().trim().min(1).max(PRODUCT_MODEL_MAX_LENGTH).optional(),
    pricing: positiveDecimalInputSchema.optional(),
    moq: z.number().int().min(1).optional(),
    description: z
      .string()
      .trim()
      .min(1)
      .max(PRODUCT_DESCRIPTION_MAX_LENGTH)
      .optional(),
    details: z
      .string()
      .trim()
      .max(PRODUCT_DETAILS_MAX_LENGTH)
      .nullable()
      .optional(),
    attributes: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;
