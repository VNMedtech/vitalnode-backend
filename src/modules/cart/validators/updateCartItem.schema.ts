import { z } from "zod";
import { CART_MAX_ITEM_QUANTITY } from "../constants/cart.constants.js";

export const updateCartItemBodySchema = z
  .object({
    quantity: z
      .number()
      .int("Quantity must be a whole number")
      .min(1, "Quantity must be at least 1")
      .max(CART_MAX_ITEM_QUANTITY, "Quantity exceeds maximum allowed"),
  })
  .strict();

export type UpdateCartItemBody = z.infer<typeof updateCartItemBodySchema>;
