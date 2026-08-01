import { z } from "zod";

export const deliveryPartnerReviewIdParamSchema = z
  .object({
    reviewId: z.string().uuid("Invalid review ID"),
  })
  .strict();

export type DeliveryPartnerReviewIdParam = z.infer<
  typeof deliveryPartnerReviewIdParamSchema
>;
