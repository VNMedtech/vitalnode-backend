import { z } from "zod";
import {
  DELIVERY_PARTNER_REVIEW_COMMENT_MAX_LENGTH,
  DELIVERY_PARTNER_REVIEW_MAX_RATING,
  DELIVERY_PARTNER_REVIEW_MIN_RATING,
} from "../constants/deliveryPartnerReview.constants.js";

export const createDeliveryPartnerReviewBodySchema = z
  .object({
    orderId: z.string().uuid("Invalid order ID"),
    rating: z
      .number()
      .int("Rating must be a whole number")
      .min(
        DELIVERY_PARTNER_REVIEW_MIN_RATING,
        `Rating must be at least ${DELIVERY_PARTNER_REVIEW_MIN_RATING}`,
      )
      .max(
        DELIVERY_PARTNER_REVIEW_MAX_RATING,
        `Rating must be at most ${DELIVERY_PARTNER_REVIEW_MAX_RATING}`,
      ),
    comment: z
      .string()
      .trim()
      .max(
        DELIVERY_PARTNER_REVIEW_COMMENT_MAX_LENGTH,
        "Comment is too long",
      )
      .optional(),
  })
  .strict();

export type CreateDeliveryPartnerReviewBody = z.infer<
  typeof createDeliveryPartnerReviewBodySchema
>;
