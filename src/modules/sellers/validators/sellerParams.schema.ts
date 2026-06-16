import { z } from "zod";

export const sellerIdParamSchema = z
  .object({
    id: z.string().uuid("Invalid seller ID"),
  })
  .strict();

export type SellerIdParam = z.infer<typeof sellerIdParamSchema>;
