import { z } from "zod";

export const inventoryProductIdParamSchema = z
  .object({
    productId: z.string().uuid("Invalid product ID"),
  })
  .strict();

export type InventoryProductIdParam = z.infer<
  typeof inventoryProductIdParamSchema
>;
