import { z } from "zod";

export const createPaymentOrderBodySchema = z.object({
  orderId: z.uuid("orderId must be a valid UUID"),
});

export type CreatePaymentOrderBody = z.infer<typeof createPaymentOrderBodySchema>;
