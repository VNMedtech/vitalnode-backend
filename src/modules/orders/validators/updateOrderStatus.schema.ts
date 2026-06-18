import { z } from "zod";
import { ORDER_DELIVERY_FAIL_REASON_MAX_LENGTH } from "../constants/order.constants.js";

export const emptyOrderStatusBodySchema = z.object({}).strict();

export const deliveryFailedBodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "Reason cannot be empty")
      .max(ORDER_DELIVERY_FAIL_REASON_MAX_LENGTH)
      .optional(),
  })
  .strict();

export type DeliveryFailedBody = z.infer<typeof deliveryFailedBodySchema>;
