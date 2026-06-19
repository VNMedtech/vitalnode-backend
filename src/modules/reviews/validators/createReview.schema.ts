import { z } from "zod";
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_MAX_RATING,
  REVIEW_MIN_RATING,
  REVIEW_TITLE_MAX_LENGTH,
} from "../constants/review.constants.js";

export const createReviewBodySchema = z
  .object({
    productId: z.string().uuid("Invalid product ID"),
    rating: z
      .number()
      .int("Rating must be a whole number")
      .min(REVIEW_MIN_RATING, `Rating must be at least ${REVIEW_MIN_RATING}`)
      .max(REVIEW_MAX_RATING, `Rating must be at most ${REVIEW_MAX_RATING}`),
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(REVIEW_TITLE_MAX_LENGTH, "Title is too long"),
    comment: z
      .string()
      .trim()
      .min(1, "Comment is required")
      .max(REVIEW_COMMENT_MAX_LENGTH, "Comment is too long"),
  })
  .strict();

export type CreateReviewBody = z.infer<typeof createReviewBodySchema>;
