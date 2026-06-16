import { z } from "zod";
import { CATEGORY_NAME_MAX_LENGTH } from "../constants/category.constants.js";

export const createCategoryBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Category name is required")
      .max(CATEGORY_NAME_MAX_LENGTH),
    description: z
      .string()
      .trim()
      .max(2000)
      .optional(),
  })
  .strict();

export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;
