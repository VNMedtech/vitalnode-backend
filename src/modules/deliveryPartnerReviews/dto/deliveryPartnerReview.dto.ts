import { DeliveryPartnerCommentStatus } from "../../../shared/enums/deliveryPartnerCommentStatus.enum.js";
import type {
  AdminDeliveryPartnerReviewRecord,
  DeliveryPartnerReviewForPartnerRecord,
  DeliveryPartnerReviewRecord,
} from "../repositories/deliveryPartnerReview.repository.js";
import type {
  AdminDeliveryPartnerReviewDto,
  DeliveryPartnerReviewBuyerSummaryDto,
  DeliveryPartnerReviewDto,
  PartnerDeliveryPartnerReviewDto,
} from "../types/deliveryPartnerReview.types.js";

function toBuyerSummary(
  buyer: AdminDeliveryPartnerReviewRecord["buyer"],
): DeliveryPartnerReviewBuyerSummaryDto {
  return {
    id: buyer.id,
    firstName: buyer.user.firstName,
    lastName: buyer.user.lastName,
  };
}

export function toDeliveryPartnerReviewDto(
  record: DeliveryPartnerReviewRecord,
): DeliveryPartnerReviewDto {
  return {
    id: record.id,
    orderId: record.orderId,
    deliveryPartnerId: record.deliveryPartnerId,
    buyerId: record.buyerId,
    rating: record.rating,
    comment: record.comment,
    commentStatus: record.commentStatus as DeliveryPartnerCommentStatus | null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toAdminDeliveryPartnerReviewDto(
  record: AdminDeliveryPartnerReviewRecord,
): AdminDeliveryPartnerReviewDto {
  return {
    ...toDeliveryPartnerReviewDto(record),
    buyer: toBuyerSummary(record.buyer),
    deliveryPartner: {
      id: record.deliveryPartner.id,
      firstName: record.deliveryPartner.user.firstName,
      lastName: record.deliveryPartner.user.lastName,
    },
    order: {
      id: record.order.id,
      orderNumber: record.order.orderNumber,
    },
  };
}

export function toPartnerDeliveryPartnerReviewDto(
  record: DeliveryPartnerReviewForPartnerRecord,
): PartnerDeliveryPartnerReviewDto {
  const commentApproved =
    record.commentStatus === DeliveryPartnerCommentStatus.APPROVED &&
    Boolean(record.comment);

  return {
    id: record.id,
    rating: record.rating,
    comment: commentApproved ? (record.comment as string) : null,
    createdAt: record.createdAt,
    order: {
      id: record.order.id,
      orderNumber: record.order.orderNumber,
    },
  };
}

/** Round average to one decimal for stats DTO (`4.5`). */
export function formatPartnerAverageRating(
  averageRating: number | null,
): number | null {
  if (averageRating === null) {
    return null;
  }
  return Math.round(averageRating * 10) / 10;
}
