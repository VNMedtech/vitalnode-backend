import { z } from "zod";
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_MAX_RATING,
  REVIEW_MIN_RATING,
  REVIEW_TITLE_MAX_LENGTH,
} from "../constants/review.constants.js";

export const updateReviewBodySchema = z
  .object({
    rating: z
      .number()
      .int("Rating must be a whole number")
      .min(REVIEW_MIN_RATING, `Rating must be at least ${REVIEW_MIN_RATING}`)
      .max(REVIEW_MAX_RATING, `Rating must be at most ${REVIEW_MAX_RATING}`)
      .optional(),
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(REVIEW_TITLE_MAX_LENGTH, "Title is too long")
      .optional(),
    comment: z
      .string()
      .trim()
      .min(1, "Comment cannot be empty")
      .max(REVIEW_COMMENT_MAX_LENGTH, "Comment is too long")
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.rating !== undefined ||
      value.title !== undefined ||
      value.comment !== undefined,
    { message: "At least one field must be provided" },
  );

export type UpdateReviewBody = z.infer<typeof updateReviewBodySchema>;
