import { z } from "zod";
import { ReviewStatus } from "../../../shared/enums/reviewStatus.enum.js";

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listProductReviewsQuerySchema = paginationQuerySchema.strict();

export type ListProductReviewsQueryInput = z.infer<
  typeof listProductReviewsQuerySchema
>;

export const listAdminReviewsQuerySchema = paginationQuerySchema
  .extend({
    productId: z.string().uuid("Invalid product ID").optional(),
    buyerId: z.string().uuid("Invalid buyer ID").optional(),
    status: z.nativeEnum(ReviewStatus).optional(),
  })
  .strict();

export type ListAdminReviewsQueryInput = z.infer<
  typeof listAdminReviewsQuerySchema
>;
