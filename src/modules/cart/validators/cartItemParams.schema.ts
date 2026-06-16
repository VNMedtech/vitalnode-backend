import { z } from "zod";

export const cartItemIdParamSchema = z
  .object({
    itemId: z.string().uuid("Invalid cart item ID"),
  })
  .strict();

export type CartItemIdParam = z.infer<typeof cartItemIdParamSchema>;
