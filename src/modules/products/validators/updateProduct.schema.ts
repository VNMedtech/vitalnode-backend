import { z } from "zod";
import {
  PRODUCT_BRAND_MAX_LENGTH,
  PRODUCT_COLOR_MAX_LENGTH,
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_DETAILS_MAX_LENGTH,
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

export const updateProductBodySchema = z
  .object({
    categoryId: z.string().uuid("Invalid category ID").optional(),
    productName: z
      .string()
      .trim()
      .min(1)
      .max(PRODUCT_NAME_MAX_LENGTH)
      .optional(),
    brand: z.string().trim().min(1).max(PRODUCT_BRAND_MAX_LENGTH).optional(),
    model: z.string().trim().min(1).max(PRODUCT_MODEL_MAX_LENGTH).optional(),
    productType: z
      .string()
      .trim()
      .min(1)
      .max(PRODUCT_TYPE_MAX_LENGTH)
      .optional(),
    color: z.string().trim().min(1).max(PRODUCT_COLOR_MAX_LENGTH).nullable().optional(),
    weight: decimalInputSchema.nullable().optional(),
    length: decimalInputSchema.nullable().optional(),
    warrantyPeriod: z.number().int().min(0).nullable().optional(),
    returnTime: z.number().int().min(0).nullable().optional(),
    deliveryTime: z.number().int().min(0).nullable().optional(),
    pricing: positiveDecimalInputSchema.optional(),
    moq: z.number().int().min(1).optional(),
    description: z
      .string()
      .trim()
      .min(1)
      .max(PRODUCT_DESCRIPTION_MAX_LENGTH)
      .optional(),
    details: z.string().trim().max(PRODUCT_DETAILS_MAX_LENGTH).nullable().optional(),
    specifications: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;
