import { z } from "zod";

export const reviewIdParamSchema = z
  .object({
    reviewId: z.string().uuid("Invalid review ID"),
  })
  .strict();

export type ReviewIdParam = z.infer<typeof reviewIdParamSchema>;

export const productReviewsParamSchema = z
  .object({
    productId: z.string().uuid("Invalid product ID"),
  })
  .strict();

export type ProductReviewsParam = z.infer<typeof productReviewsParamSchema>;
