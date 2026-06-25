import { z } from "zod";
import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import {
  PRODUCT_DEFAULT_LIMIT,
  PRODUCT_DEFAULT_PAGE,
  PRODUCT_MAX_LIMIT,
  PRODUCT_SEARCH_MAX_LENGTH,
  PRODUCT_SORT_FIELDS,
} from "../constants/product.constants.js";

const decimalFilterSchema = z
  .union([
    z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal with up to 2 places"),
    z.number().finite().nonnegative(),
  ])
  .transform((value) => (typeof value === "number" ? value.toString() : value));

const baseListProductsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(PRODUCT_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(PRODUCT_MAX_LIMIT)
      .default(PRODUCT_DEFAULT_LIMIT),
    sortBy: z.enum(PRODUCT_SORT_FIELDS).default("newest"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().trim().min(1).max(PRODUCT_SEARCH_MAX_LENGTH).optional(),
    categoryId: z.string().uuid("Invalid category ID").optional(),
    brand: z.string().trim().min(1).max(120).optional(),
    status: z.nativeEnum(ProductStatus).optional(),
    minPrice: decimalFilterSchema.optional(),
    maxPrice: decimalFilterSchema.optional(),
  })
  .strict();

export const listMarketplaceProductsQuerySchema = baseListProductsQuerySchema
  .omit({ status: true, sortBy: true, sortOrder: true })
  .extend({
    sortBy: z.enum(PRODUCT_SORT_FIELDS).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  })
  .strict();

export const listOwnProductsQuerySchema = baseListProductsQuerySchema.strict();

export const listPendingProductsQuerySchema = baseListProductsQuerySchema
  .omit({ status: true })
  .strict();

export type ListMarketplaceProductsQueryInput = z.infer<
  typeof listMarketplaceProductsQuerySchema
>;

export type ListOwnProductsQueryInput = z.infer<
  typeof listOwnProductsQuerySchema
>;

export type ListPendingProductsQueryInput = z.infer<
  typeof listPendingProductsQuerySchema
>;
