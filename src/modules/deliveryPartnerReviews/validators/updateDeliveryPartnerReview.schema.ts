import { z } from "zod";
import {
  DELIVERY_PARTNER_REVIEW_COMMENT_MAX_LENGTH,
  DELIVERY_PARTNER_REVIEW_MAX_RATING,
  DELIVERY_PARTNER_REVIEW_MIN_RATING,
} from "../constants/deliveryPartnerReview.constants.js";

export const updateDeliveryPartnerReviewBodySchema = z
  .object({
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
      )
      .optional(),
    comment: z
      .string()
      .trim()
      .max(
        DELIVERY_PARTNER_REVIEW_COMMENT_MAX_LENGTH,
        "Comment is too long",
      )
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (value) => value.rating !== undefined || value.comment !== undefined,
    { message: "At least one field must be provided" },
  );

export type UpdateDeliveryPartnerReviewBody = z.infer<
  typeof updateDeliveryPartnerReviewBodySchema
>;
