import { prisma } from "../../../infrastructure/prisma/client.js";
import { isPostDeliveryOrderStatus } from "../../../shared/constants/orderSettlement.constants.js";
import { DeliveryPartnerCommentStatus } from "../../../shared/enums/deliveryPartnerCommentStatus.enum.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import { BuyerRepository } from "../../buyers/repositories/buyer.repository.js";
import {
  DELIVERY_PARTNER_REVIEW_ACTIONS,
  DELIVERY_PARTNER_REVIEW_AUDIT_ENTITY_TYPE,
} from "../constants/deliveryPartnerReview.constants.js";
import {
  formatPartnerAverageRating,
  toAdminDeliveryPartnerReviewDto,
  toDeliveryPartnerReviewDto,
  toPartnerDeliveryPartnerReviewDto,
} from "../dto/deliveryPartnerReview.dto.js";
import { DeliveryPartnerReviewEligibilityRepository } from "../repositories/deliveryPartnerReviewEligibility.repository.js";
import {
  DeliveryPartnerReviewRepository,
  type UpdateDeliveryPartnerReviewData,
} from "../repositories/deliveryPartnerReview.repository.js";
import type {
  AdminDeliveryPartnerReviewDto,
  CreateDeliveryPartnerReviewInput,
  DeliveryPartnerReviewDto,
  ListAdminDeliveryPartnerReviewsQuery,
  ListMineDeliveryPartnerReviewsQuery,
  PartnerDeliveryPartnerReviewDto,
  UpdateDeliveryPartnerReviewInput,
} from "../types/deliveryPartnerReview.types.js";

function normalizeComment(comment: string | null | undefined): string | null {
  if (comment === undefined || comment === null) {
    return null;
  }
  const trimmed = comment.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class DeliveryPartnerReviewService {
  private readonly reviewRepo = new DeliveryPartnerReviewRepository(prisma);
  private readonly eligibilityRepo =
    new DeliveryPartnerReviewEligibilityRepository(prisma);
  private readonly buyerRepo = new BuyerRepository(prisma);

  private async resolveBuyerId(actorUserId: string): Promise<string> {
    const buyer = await this.buyerRepo.findIdByUserId(actorUserId);
    if (!buyer) {
      throw new ForbiddenError("Buyer profile required");
    }
    return buyer.id;
  }

  private async resolveDeliveryPartnerId(
    actorUserId: string,
  ): Promise<string> {
    const partner = await prisma.deliveryPartnerProfile.findUnique({
      where: { userId: actorUserId },
      select: { id: true },
    });
    if (!partner) {
      throw new ForbiddenError("Delivery partner profile required");
    }
    return partner.id;
  }

  private async assertBuyerCanRateOrder(
    buyerId: string,
    orderId: string,
  ): Promise<{ deliveryPartnerId: string }> {
    const eligible = await this.eligibilityRepo.findEligibleOrderForBuyer(
      orderId,
      buyerId,
    );
    if (eligible) {
      return { deliveryPartnerId: eligible.deliveryPartnerId };
    }

    const order = await this.eligibilityRepo.findOrderOwnership(orderId);
    if (!order || order.buyerId !== buyerId) {
      throw new NotFoundError("Order not found");
    }

    if (!isPostDeliveryOrderStatus(order.orderStatus)) {
      throw new ForbiddenError(
        "You can only rate delivery after the order is delivered",
      );
    }

    if (!order.deliveryPartnerId) {
      throw new ForbiddenError(
        "This order has no delivery partner to rate",
      );
    }

    throw new ForbiddenError("You cannot rate the delivery for this order");
  }

  private async getOwnedReviewOrThrow(reviewId: string, buyerId: string) {
    const review = await this.reviewRepo.findById(reviewId);
    if (!review) {
      throw new NotFoundError("Delivery partner review not found");
    }
    if (review.buyerId !== buyerId) {
      throw new ForbiddenError("You can only manage your own reviews");
    }
    if (review.commentStatus === DeliveryPartnerCommentStatus.DISABLED) {
      throw new ForbiddenError("This review has been disabled");
    }
    return review;
  }

  async createReview(
    actorUserId: string,
    input: CreateDeliveryPartnerReviewInput,
  ): Promise<DeliveryPartnerReviewDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    const { deliveryPartnerId } = await this.assertBuyerCanRateOrder(
      buyerId,
      input.orderId,
    );

    const existing = await this.reviewRepo.findByOrderId(input.orderId);
    if (existing) {
      if (existing.commentStatus === DeliveryPartnerCommentStatus.DISABLED) {
        throw new ForbiddenError("This review has been disabled");
      }
      throw new ConflictError(
        "You have already rated the delivery for this order",
      );
    }

    const comment = normalizeComment(input.comment);
    const commentStatus = comment
      ? DeliveryPartnerCommentStatus.PENDING
      : null;

    const review = await this.reviewRepo.create({
      orderId: input.orderId,
      deliveryPartnerId,
      buyerId,
      rating: input.rating,
      comment,
      commentStatus,
    });

    auditLogger.log({
      actorUserId,
      action: DELIVERY_PARTNER_REVIEW_ACTIONS.CREATE,
      entityType: DELIVERY_PARTNER_REVIEW_AUDIT_ENTITY_TYPE,
      entityId: review.id,
      metadata: {
        orderId: input.orderId,
        deliveryPartnerId,
        rating: input.rating,
        hasComment: comment !== null,
      },
    });

    return toDeliveryPartnerReviewDto(review);
  }

  async updateReview(
    actorUserId: string,
    reviewId: string,
    input: UpdateDeliveryPartnerReviewInput,
  ): Promise<DeliveryPartnerReviewDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    const existing = await this.getOwnedReviewOrThrow(reviewId, buyerId);

    const data: UpdateDeliveryPartnerReviewData = {};

    if (input.rating !== undefined) {
      data.rating = input.rating;
    }

    if (input.comment !== undefined) {
      const nextComment = normalizeComment(input.comment);
      if (nextComment === null) {
        data.comment = null;
        data.commentStatus = null;
      } else if (nextComment !== existing.comment) {
        data.comment = nextComment;
        data.commentStatus = DeliveryPartnerCommentStatus.PENDING;
      }
    }

    if (Object.keys(data).length === 0) {
      return toDeliveryPartnerReviewDto(existing);
    }

    const updated = await this.reviewRepo.update(reviewId, data);

    auditLogger.log({
      actorUserId,
      action: DELIVERY_PARTNER_REVIEW_ACTIONS.UPDATE,
      entityType: DELIVERY_PARTNER_REVIEW_AUDIT_ENTITY_TYPE,
      entityId: reviewId,
      metadata: { changedFields: Object.keys(input) },
    });

    return toDeliveryPartnerReviewDto(updated);
  }

  async listAdminReviews(query: ListAdminDeliveryPartnerReviewsQuery): Promise<{
    items: AdminDeliveryPartnerReviewDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const filter = {
      deliveryPartnerId: query.deliveryPartnerId,
      buyerId: query.buyerId,
      orderId: query.orderId,
      commentStatus: query.commentStatus,
    };

    const [records, total] = await Promise.all([
      this.reviewRepo.findManyPaginated({
        ...query,
        ...filter,
      }),
      this.reviewRepo.count(filter),
    ]);

    return {
      items: records.map((record) => toAdminDeliveryPartnerReviewDto(record)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  /**
   * Partner Feedback list: all non-DISABLED reviews (individual ratings).
   * Comment text is included in the DTO only when APPROVED.
   */
  async listMineReviews(
    actorUserId: string,
    query: ListMineDeliveryPartnerReviewsQuery,
  ): Promise<{
    items: PartnerDeliveryPartnerReviewDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const deliveryPartnerId = await this.resolveDeliveryPartnerId(actorUserId);

    const [records, total] = await Promise.all([
      this.reviewRepo.findPartnerVisibleReviewsPaginated({
        deliveryPartnerId,
        page: query.page,
        limit: query.limit,
      }),
      this.reviewRepo.countPartnerVisibleReviews(deliveryPartnerId),
    ]);

    return {
      items: records.map((record) => toPartnerDeliveryPartnerReviewDto(record)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async approveReview(
    actorUserId: string,
    reviewId: string,
  ): Promise<AdminDeliveryPartnerReviewDto> {
    const review = await this.reviewRepo.findByIdForAdmin(reviewId);
    if (!review) {
      throw new NotFoundError("Delivery partner review not found");
    }

    if (!review.comment) {
      throw new ConflictError("Review has no comment to approve");
    }

    if (review.commentStatus === DeliveryPartnerCommentStatus.APPROVED) {
      throw new ConflictError("Comment is already approved");
    }

    if (review.commentStatus === DeliveryPartnerCommentStatus.DISABLED) {
      throw new ConflictError("Cannot approve a disabled review");
    }

    const approved = await this.reviewRepo.approve(reviewId);

    auditLogger.log({
      actorUserId,
      action: DELIVERY_PARTNER_REVIEW_ACTIONS.APPROVE,
      entityType: DELIVERY_PARTNER_REVIEW_AUDIT_ENTITY_TYPE,
      entityId: reviewId,
      metadata: {
        deliveryPartnerId: review.deliveryPartnerId,
        orderId: review.orderId,
      },
    });

    return toAdminDeliveryPartnerReviewDto(approved);
  }

  async disableReview(
    actorUserId: string,
    reviewId: string,
  ): Promise<AdminDeliveryPartnerReviewDto> {
    const review = await this.reviewRepo.findByIdForAdmin(reviewId);
    if (!review) {
      throw new NotFoundError("Delivery partner review not found");
    }

    if (review.commentStatus === DeliveryPartnerCommentStatus.DISABLED) {
      throw new ConflictError("Review is already disabled");
    }

    const disabled = await this.reviewRepo.disable(reviewId);

    auditLogger.log({
      actorUserId,
      action: DELIVERY_PARTNER_REVIEW_ACTIONS.DISABLE,
      entityType: DELIVERY_PARTNER_REVIEW_AUDIT_ENTITY_TYPE,
      entityId: reviewId,
      metadata: {
        deliveryPartnerId: review.deliveryPartnerId,
        orderId: review.orderId,
        previousCommentStatus: review.commentStatus,
      },
    });

    return toAdminDeliveryPartnerReviewDto(disabled);
  }

  async getPartnerRatingStats(deliveryPartnerId: string): Promise<{
    rating: number | null;
    ratingCount: number;
  }> {
    const stats = await this.reviewRepo.getStatsForPartner(deliveryPartnerId);
    if (stats.ratingCount === 0) {
      return { rating: null, ratingCount: 0 };
    }
    return {
      rating: formatPartnerAverageRating(stats.averageRating),
      ratingCount: stats.ratingCount,
    };
  }
}
