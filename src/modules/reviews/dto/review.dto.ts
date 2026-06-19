import type { ReviewStatus } from "../../../shared/enums/reviewStatus.enum.js";
import type {
  AdminReviewRecord,
  ProductReviewStatsRecord,
  ReviewRecord,
} from "../repositories/review.repository.js";
import type {
  ProductReviewStats,
  ReviewBuyerSummaryDto,
  ReviewDto,
  ReviewProductSummaryDto,
} from "../types/review.types.js";

function formatAverageRating(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  return value.toFixed(1);
}

export function toProductReviewStats(
  stats: ProductReviewStatsRecord,
): ProductReviewStats {
  return {
    averageRating: formatAverageRating(stats.averageRating),
    reviewCount: stats.reviewCount,
  };
}

function toBuyerSummary(
  buyer: ReviewRecord["buyer"],
): ReviewBuyerSummaryDto {
  return {
    id: buyer.id,
    firstName: buyer.user.firstName,
    lastName: buyer.user.lastName,
  };
}

function toProductSummary(
  product: NonNullable<AdminReviewRecord["product"]>,
): ReviewProductSummaryDto {
  return {
    id: product.id,
    productName: product.productName,
    brand: product.brand,
    model: product.model,
  };
}

export function toReviewDto(record: ReviewRecord): ReviewDto {
  return {
    id: record.id,
    productId: record.productId,
    buyerId: record.buyerId,
    rating: record.rating,
    title: record.title,
    comment: record.comment,
    status: record.status as ReviewStatus,
    buyer: toBuyerSummary(record.buyer),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toAdminReviewDto(record: AdminReviewRecord): ReviewDto {
  return {
    ...toReviewDto(record),
    product: record.product ? toProductSummary(record.product) : undefined,
  };
}
