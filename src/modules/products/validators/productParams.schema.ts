import { z } from "zod";

export const productIdParamSchema = z
  .object({
    id: z.string().uuid("Invalid product ID"),
  })
  .strict();

export type ProductIdParam = z.infer<typeof productIdParamSchema>;
