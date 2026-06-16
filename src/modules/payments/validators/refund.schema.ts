import { z } from "zod";

export const refundBodySchema = z.object({
  orderId: z.uuid("orderId must be a valid UUID"),
});

export type RefundBody = z.infer<typeof refundBodySchema>;
