import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { ReviewService } from "../services/review.service.js";
import type { CreateReviewBody } from "../validators/createReview.schema.js";
import type {
  ListAdminReviewsQueryInput,
  ListProductReviewsQueryInput,
} from "../validators/query.schema.js";
import type {
  ProductReviewsParam,
  ReviewIdParam,
} from "../validators/reviewParams.schema.js";
import type { UpdateReviewBody } from "../validators/updateReview.schema.js";

const reviewService = new ReviewService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const createReview: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const body = req.body as CreateReviewBody;
    const review = await reviewService.createReview(actorUserId, body);
    res
      .status(201)
      .json(successResponse(review, "Review created successfully"));
  } catch (err) {
    next(err);
  }
};

export const updateReview: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { reviewId } = req.params as ReviewIdParam;
    const body = req.body as UpdateReviewBody;
    const review = await reviewService.updateReview(
      actorUserId,
      reviewId,
      body,
    );
    res
      .status(200)
      .json(successResponse(review, "Review updated successfully"));
  } catch (err) {
    next(err);
  }
};

export const deleteReview: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { reviewId } = req.params as ReviewIdParam;
    await reviewService.deleteReview(actorUserId, reviewId);
    res.status(200).json(successResponse(null, "Review deleted successfully"));
  } catch (err) {
    next(err);
  }
};

export const listProductReviews: RequestHandler = async (req, res, next) => {
  try {
    const { productId } = req.params as ProductReviewsParam;
    const query = req.query as unknown as ListProductReviewsQueryInput;
    const result = await reviewService.listProductReviews(productId, query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Product reviews fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const listAdminReviews: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListAdminReviewsQueryInput;
    const result = await reviewService.listAdminReviews(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Reviews fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const disableReview: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { reviewId } = req.params as ReviewIdParam;
    const review = await reviewService.disableReview(actorUserId, reviewId);
    res
      .status(200)
      .json(successResponse(review, "Review disabled successfully"));
  } catch (err) {
    next(err);
  }
};
