import { z } from "zod";
import { ORDER_CANCEL_REASON_MAX_LENGTH } from "../constants/order.constants.js";

export const cancelOrderBodySchema = z
  .object({
    orderId: z.string().uuid("Invalid order ID"),
    reason: z
      .string()
      .trim()
      .min(1, "Reason cannot be empty")
      .max(ORDER_CANCEL_REASON_MAX_LENGTH)
      .optional(),
  })
  .strict();

export const cancelOrderByIdBodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "Reason cannot be empty")
      .max(ORDER_CANCEL_REASON_MAX_LENGTH)
      .optional(),
  })
  .strict();

export type CancelOrderBody = z.infer<typeof cancelOrderBodySchema>;
export type CancelOrderByIdBody = z.infer<typeof cancelOrderByIdBodySchema>;
