import type { ReviewStatus } from "../../../shared/enums/reviewStatus.enum.js";

export interface ReviewBuyerSummaryDto {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ReviewProductSummaryDto {
  id: string;
  productName: string;
  brand: string;
  model: string;
}

export interface ReviewDto {
  id: string;
  productId: string;
  buyerId: string;
  rating: number;
  title: string;
  comment: string;
  status: ReviewStatus;
  buyer: ReviewBuyerSummaryDto;
  product?: ReviewProductSummaryDto;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductReviewStats {
  averageRating: string | null;
  reviewCount: number;
}

export interface CreateReviewInput {
  productId: string;
  rating: number;
  title: string;
  comment: string;
}

export interface UpdateReviewInput {
  rating?: number;
  title?: string;
  comment?: string;
}

export interface ListProductReviewsQuery {
  page: number;
  limit: number;
}

export interface ListAdminReviewsQuery extends ListProductReviewsQuery {
  productId?: string;
  buyerId?: string;
  status?: ReviewStatus;
}
