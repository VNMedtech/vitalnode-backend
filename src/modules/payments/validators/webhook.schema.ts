import { z } from "zod";

const webhookPaymentEntitySchema = z.object({
  id: z.string(),
  order_id: z.string(),
  amount: z.number(),
  status: z.string(),
});

const webhookRefundEntitySchema = z.object({
  id: z.string(),
  payment_id: z.string(),
  amount: z.number(),
  status: z.string(),
});

export const webhookBodySchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z
      .object({
        entity: webhookPaymentEntitySchema,
      })
      .optional(),
    order: z
      .object({
        entity: z.object({
          id: z.string(),
          amount: z.number(),
        }),
      })
      .optional(),
    refund: z
      .object({
        entity: webhookRefundEntitySchema,
      })
      .optional(),
  }),
});

export type WebhookBody = z.infer<typeof webhookBodySchema>;
