import { z } from "zod";
import { DeliveryPartnerCommentStatus } from "../../../shared/enums/deliveryPartnerCommentStatus.enum.js";

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listAdminDeliveryPartnerReviewsQuerySchema = paginationQuerySchema
  .extend({
    deliveryPartnerId: z.string().uuid("Invalid delivery partner ID").optional(),
    buyerId: z.string().uuid("Invalid buyer ID").optional(),
    orderId: z.string().uuid("Invalid order ID").optional(),
    commentStatus: z.nativeEnum(DeliveryPartnerCommentStatus).optional(),
  })
  .strict();

export type ListAdminDeliveryPartnerReviewsQueryInput = z.infer<
  typeof listAdminDeliveryPartnerReviewsQuerySchema
>;

export const listMineDeliveryPartnerReviewsQuerySchema =
  paginationQuerySchema.strict();

export type ListMineDeliveryPartnerReviewsQueryInput = z.infer<
  typeof listMineDeliveryPartnerReviewsQuerySchema
>;
