import { z } from "zod";
import { INVENTORY_NOTES_MAX_LENGTH } from "../constants/inventory.constants.js";

export const updateInventoryBodySchema = z
  .object({
    availableQuantity: z.coerce
      .number()
      .int("Quantity must be a whole number")
      .min(0, "Quantity cannot be negative"),
    reason: z.string().trim().max(INVENTORY_NOTES_MAX_LENGTH).optional(),
    notes: z.string().trim().max(INVENTORY_NOTES_MAX_LENGTH).optional(),
  })
  .strict();

export type UpdateInventoryBody = z.infer<typeof updateInventoryBodySchema>;
