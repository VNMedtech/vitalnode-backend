import { z } from "zod";
import {
  CATEGORY_DEFAULT_LIMIT,
  CATEGORY_DEFAULT_PAGE,
  CATEGORY_MAX_LIMIT,
  CATEGORY_SORT_FIELDS,
} from "../constants/category.constants.js";

export const listCategoriesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(CATEGORY_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(CATEGORY_MAX_LIMIT)
      .default(CATEGORY_DEFAULT_LIMIT),
    sortBy: z.enum(CATEGORY_SORT_FIELDS).default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
    search: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type ListCategoriesQueryInput = z.infer<typeof listCategoriesQuerySchema>;
