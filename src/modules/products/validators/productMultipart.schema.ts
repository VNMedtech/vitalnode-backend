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
import {
  documentTypesFromForm,
  nullableIntFromForm,
  nullableSpecificationsFromForm,
  nullableStringFromForm,
  optionalIntFromForm,
  specificationsFromForm,
} from "./multipartForm.util.js";

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

export const createProductMultipartBodySchema = z
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
    warrantyPeriod: optionalIntFromForm,
    returnTime: optionalIntFromForm,
    deliveryTime: optionalIntFromForm,
    pricing: positiveDecimalInputSchema,
    moq: z.coerce.number().int().min(1, "MOQ must be at least 1"),
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(PRODUCT_DESCRIPTION_MAX_LENGTH),
    details: z.string().trim().max(PRODUCT_DETAILS_MAX_LENGTH).optional(),
    specifications: specificationsFromForm,
    documentTypes: documentTypesFromForm,
  })
  .strict();

export type CreateProductMultipartBody = z.infer<
  typeof createProductMultipartBodySchema
>;

export const updateProductMultipartBodySchema = z
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
    color: z
      .string()
      .trim()
      .min(1)
      .max(PRODUCT_COLOR_MAX_LENGTH)
      .nullable()
      .optional(),
    weight: decimalInputSchema.nullable().optional(),
    length: decimalInputSchema.nullable().optional(),
    warrantyPeriod: nullableIntFromForm,
    returnTime: nullableIntFromForm,
    deliveryTime: nullableIntFromForm,
    pricing: positiveDecimalInputSchema.optional(),
    moq: z.coerce.number().int().min(1).optional(),
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
    specifications: nullableSpecificationsFromForm,
    documentTypes: documentTypesFromForm,
    replaceMedia: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    replaceDocuments: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      Object.keys(data).some(
        (key) => data[key as keyof typeof data] !== undefined,
      ),
    { message: "At least one field must be provided" },
  );

export type UpdateProductMultipartBody = z.infer<
  typeof updateProductMultipartBodySchema
>;
