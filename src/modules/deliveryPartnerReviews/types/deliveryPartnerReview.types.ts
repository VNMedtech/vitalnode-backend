import type { DeliveryPartnerCommentStatus } from "../../../shared/enums/deliveryPartnerCommentStatus.enum.js";

export interface DeliveryPartnerReviewBuyerSummaryDto {
  id: string;
  firstName: string;
  lastName: string;
}

export interface DeliveryPartnerReviewPartnerSummaryDto {
  id: string;
  firstName: string;
  lastName: string;
}

export interface DeliveryPartnerReviewOrderSummaryDto {
  id: string;
  orderNumber: string;
}

export interface DeliveryPartnerReviewDto {
  id: string;
  orderId: string;
  deliveryPartnerId: string;
  buyerId: string;
  rating: number;
  comment: string | null;
  commentStatus: DeliveryPartnerCommentStatus | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminDeliveryPartnerReviewDto extends DeliveryPartnerReviewDto {
  buyer: DeliveryPartnerReviewBuyerSummaryDto;
  deliveryPartner: DeliveryPartnerReviewPartnerSummaryDto;
  order: DeliveryPartnerReviewOrderSummaryDto;
}

export interface PartnerDeliveryPartnerReviewDto {
  id: string;
  rating: number;
  /** Present only when commentStatus is APPROVED; otherwise null. */
  comment: string | null;
  createdAt: Date;
  order: DeliveryPartnerReviewOrderSummaryDto;
}

export interface CreateDeliveryPartnerReviewInput {
  orderId: string;
  rating: number;
  comment?: string;
}

export interface UpdateDeliveryPartnerReviewInput {
  rating?: number;
  /** Undefined = leave unchanged; null/empty = clear comment. */
  comment?: string | null;
}

export interface ListAdminDeliveryPartnerReviewsQuery {
  page: number;
  limit: number;
  deliveryPartnerId?: string;
  buyerId?: string;
  orderId?: string;
  commentStatus?: DeliveryPartnerCommentStatus;
}

export interface ListMineDeliveryPartnerReviewsQuery {
  page: number;
  limit: number;
}
