import { z } from "zod";
import { CATEGORY_NAME_MAX_LENGTH } from "../constants/category.constants.js";

export const updateCategoryBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Category name cannot be empty")
      .max(CATEGORY_NAME_MAX_LENGTH)
      .optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()
  .refine(
    (data) => data.name !== undefined || data.description !== undefined,
    { message: "At least one field must be provided" },
  );

export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>;
