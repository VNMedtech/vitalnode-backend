import { z } from "zod";

export const categoryIdParamSchema = z
  .object({
    id: z.string().uuid("Invalid category ID"),
  })
  .strict();

export type CategoryIdParam = z.infer<typeof categoryIdParamSchema>;
