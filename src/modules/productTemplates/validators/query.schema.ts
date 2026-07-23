import { z } from "zod";
import {
  PRODUCT_TEMPLATE_DEFAULT_LIMIT,
  PRODUCT_TEMPLATE_DEFAULT_PAGE,
  PRODUCT_TEMPLATE_MAX_LIMIT,
  PRODUCT_TEMPLATE_SEARCH_MAX_LENGTH,
  PRODUCT_TEMPLATE_SORT_FIELDS,
} from "../constants/productTemplate.constants.js";

export const productTemplateIdParamSchema = z
  .object({
    id: z.string().uuid("Invalid template ID"),
  })
  .strict();

export type ProductTemplateIdParam = z.infer<
  typeof productTemplateIdParamSchema
>;

export const listProductTemplatesQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int()
      .min(1)
      .default(PRODUCT_TEMPLATE_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(PRODUCT_TEMPLATE_MAX_LIMIT)
      .default(PRODUCT_TEMPLATE_DEFAULT_LIMIT),
    sortBy: z.enum(PRODUCT_TEMPLATE_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    q: z.string().trim().max(PRODUCT_TEMPLATE_SEARCH_MAX_LENGTH).optional(),
    categoryId: z.string().uuid("Invalid category ID").optional(),
    isActive: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .strict();

export type ListProductTemplatesQueryInput = z.infer<
  typeof listProductTemplatesQuerySchema
>;

export const searchProductTemplatesQuerySchema = z
  .object({
    categoryIds: z.preprocess(
      (value) => {
        if (value === undefined || value === null || value === "") {
          return undefined;
        }
        if (Array.isArray(value)) {
          return value;
        }
        return String(value)
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
      },
      z
        .array(z.string().uuid("Invalid category ID"))
        .min(1, "At least one categoryId is required"),
    ),
    q: z.string().trim().max(PRODUCT_TEMPLATE_SEARCH_MAX_LENGTH).optional(),
  })
  .strict();

export type SearchProductTemplatesQueryInput = z.infer<
  typeof searchProductTemplatesQuerySchema
>;
