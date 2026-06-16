import { z } from "zod";

export const paymentOrderIdParamSchema = z
  .object({
    orderId: z.string().uuid("Invalid order ID"),
  })
  .strict();

export type PaymentOrderIdParam = z.infer<typeof paymentOrderIdParamSchema>;
