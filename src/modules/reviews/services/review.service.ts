import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { ReviewStatus } from "../../../shared/enums/reviewStatus.enum.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import { BuyerRepository } from "../../buyers/repositories/buyer.repository.js";
import { ProductRepository } from "../../products/repositories/product.repository.js";
import {
  REVIEW_ACTIONS,
  REVIEW_AUDIT_ENTITY_TYPE,
} from "../constants/review.constants.js";
import {
  toAdminReviewDto,
  toProductReviewStats,
  toReviewDto,
} from "../dto/review.dto.js";
import { ReviewEligibilityRepository } from "../repositories/reviewEligibility.repository.js";
import { ReviewRepository } from "../repositories/review.repository.js";
import type {
  CreateReviewInput,
  FeaturedReviewsPayload,
  ListAdminReviewsQuery,
  ListFeaturedReviewsQuery,
  ListProductReviewsQuery,
  ReviewDto,
  UpdateReviewInput,
} from "../types/review.types.js";

export class ReviewService {
  private readonly reviewRepo = new ReviewRepository(prisma);
  private readonly eligibilityRepo = new ReviewEligibilityRepository(prisma);
  private readonly buyerRepo = new BuyerRepository(prisma);
  private readonly productRepo = new ProductRepository(prisma);

  private async resolveBuyerId(actorUserId: string): Promise<string> {
    const buyer = await this.buyerRepo.findIdByUserId(actorUserId);
    if (!buyer) {
      throw new ForbiddenError("Buyer profile required");
    }
    return buyer.id;
  }

  private async assertBuyerCanReview(
    buyerId: string,
    productId: string,
  ): Promise<void> {
    const product = await this.productRepo.findMarketplaceDetailById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const hasDeliveredPurchase = await this.eligibilityRepo.hasDeliveredPurchase(
      buyerId,
      productId,
    );
    if (!hasDeliveredPurchase) {
      throw new ForbiddenError(
        "You can only review products from delivered orders",
      );
    }
  }

  private async getOwnedReviewOrThrow(reviewId: string, buyerId: string) {
    const review = await this.reviewRepo.findById(reviewId);
    if (!review) {
      throw new NotFoundError("Review not found");
    }
    if (review.buyerId !== buyerId) {
      throw new ForbiddenError("You can only manage your own reviews");
    }
    if (review.status === ReviewStatus.DISABLED) {
      throw new ForbiddenError("This review has been disabled");
    }
    return review;
  }

  async createReview(
    actorUserId: string,
    input: CreateReviewInput,
  ): Promise<ReviewDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    await this.assertBuyerCanReview(buyerId, input.productId);

    const existing = await this.reviewRepo.findByProductAndBuyer(
      input.productId,
      buyerId,
    );
    if (existing) {
      throw new ConflictError("You have already reviewed this product");
    }

    const review = await this.reviewRepo.create({
      productId: input.productId,
      buyerId,
      rating: input.rating,
      title: input.title,
      comment: input.comment,
    });

    auditLogger.log({
      actorUserId,
      action: REVIEW_ACTIONS.CREATE,
      entityType: REVIEW_AUDIT_ENTITY_TYPE,
      entityId: review.id,
      metadata: {
        productId: input.productId,
        rating: input.rating,
      },
    });

    return toReviewDto(review);
  }

  async updateReview(
    actorUserId: string,
    reviewId: string,
    input: UpdateReviewInput,
  ): Promise<ReviewDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    await this.getOwnedReviewOrThrow(reviewId, buyerId);

    const updated = await this.reviewRepo.update(reviewId, input);

    auditLogger.log({
      actorUserId,
      action: REVIEW_ACTIONS.UPDATE,
      entityType: REVIEW_AUDIT_ENTITY_TYPE,
      entityId: reviewId,
      metadata: { changedFields: Object.keys(input) },
    });

    return toReviewDto(updated);
  }

  async deleteReview(actorUserId: string, reviewId: string): Promise<void> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    const review = await this.getOwnedReviewOrThrow(reviewId, buyerId);

    await this.reviewRepo.delete(reviewId);

    auditLogger.log({
      actorUserId,
      action: REVIEW_ACTIONS.DELETE,
      entityType: REVIEW_AUDIT_ENTITY_TYPE,
      entityId: reviewId,
      metadata: { productId: review.productId },
    });
  }

  async listFeaturedReviews(
    query: ListFeaturedReviewsQuery,
  ): Promise<FeaturedReviewsPayload> {
    const [records, stats] = await Promise.all([
      this.reviewRepo.findFeatured(query.limit),
      this.reviewRepo.getPlatformStats(),
    ]);

    return {
      reviews: records.map((record) => toAdminReviewDto(record)),
      stats: toProductReviewStats(stats),
    };
  }

  async listProductReviews(
    productId: string,
    query: ListProductReviewsQuery,
  ): Promise<{
    items: ReviewDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const product = await this.productRepo.findMarketplaceDetailById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const filter = {
      productId,
      activeOnly: true,
    };

    const [records, total] = await Promise.all([
      this.reviewRepo.findManyPaginated({
        ...query,
        ...filter,
      }),
      this.reviewRepo.count(filter),
    ]);

    return {
      items: records.map((record) => toReviewDto(record as never)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async listAdminReviews(query: ListAdminReviewsQuery): Promise<{
    items: ReviewDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const filter = {
      productId: query.productId,
      buyerId: query.buyerId,
      status: query.status,
      activeOnly: false,
    };

    const [records, total] = await Promise.all([
      this.reviewRepo.findManyPaginated({
        ...query,
        ...filter,
      }),
      this.reviewRepo.count(filter),
    ]);

    return {
      items: records.map((record) => toAdminReviewDto(record as never)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async disableReview(actorUserId: string, reviewId: string): Promise<ReviewDto> {
    const review = await this.reviewRepo.findByIdForAdmin(reviewId);
    if (!review) {
      throw new NotFoundError("Review not found");
    }

    if (review.status === ReviewStatus.DISABLED) {
      throw new ConflictError("Review is already disabled");
    }

    const disabled = await this.reviewRepo.disable(reviewId);

    auditLogger.log({
      actorUserId,
      action: REVIEW_ACTIONS.DISABLE,
      entityType: REVIEW_AUDIT_ENTITY_TYPE,
      entityId: reviewId,
      metadata: { productId: review.productId },
    });

    return toAdminReviewDto(disabled);
  }
}
