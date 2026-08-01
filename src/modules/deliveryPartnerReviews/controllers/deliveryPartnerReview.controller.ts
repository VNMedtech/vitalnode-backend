import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { DeliveryPartnerReviewService } from "../services/deliveryPartnerReview.service.js";
import type { CreateDeliveryPartnerReviewBody } from "../validators/createDeliveryPartnerReview.schema.js";
import type { DeliveryPartnerReviewIdParam } from "../validators/deliveryPartnerReviewParams.schema.js";
import type {
  ListAdminDeliveryPartnerReviewsQueryInput,
  ListMineDeliveryPartnerReviewsQueryInput,
} from "../validators/query.schema.js";
import type { UpdateDeliveryPartnerReviewBody } from "../validators/updateDeliveryPartnerReview.schema.js";

const deliveryPartnerReviewService = new DeliveryPartnerReviewService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const createDeliveryPartnerReview: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const body = req.body as CreateDeliveryPartnerReviewBody;
    const review = await deliveryPartnerReviewService.createReview(
      actorUserId,
      body,
    );
    res
      .status(201)
      .json(
        successResponse(review, "Delivery partner review created successfully"),
      );
  } catch (err) {
    next(err);
  }
};

export const updateDeliveryPartnerReview: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { reviewId } = req.params as DeliveryPartnerReviewIdParam;
    const body = req.body as UpdateDeliveryPartnerReviewBody;
    const review = await deliveryPartnerReviewService.updateReview(
      actorUserId,
      reviewId,
      body,
    );
    res
      .status(200)
      .json(
        successResponse(review, "Delivery partner review updated successfully"),
      );
  } catch (err) {
    next(err);
  }
};

export const listAdminDeliveryPartnerReviews: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const query = req.query as unknown as ListAdminDeliveryPartnerReviewsQueryInput;
    const result = await deliveryPartnerReviewService.listAdminReviews(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Delivery partner reviews fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const listMineDeliveryPartnerReviews: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const query =
      req.query as unknown as ListMineDeliveryPartnerReviewsQueryInput;
    const result = await deliveryPartnerReviewService.listMineReviews(
      actorUserId,
      query,
    );
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Delivery partner reviews fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const approveDeliveryPartnerReview: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { reviewId } = req.params as DeliveryPartnerReviewIdParam;
    const review = await deliveryPartnerReviewService.approveReview(
      actorUserId,
      reviewId,
    );
    res
      .status(200)
      .json(
        successResponse(
          review,
          "Delivery partner review comment approved successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const disableDeliveryPartnerReview: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { reviewId } = req.params as DeliveryPartnerReviewIdParam;
    const review = await deliveryPartnerReviewService.disableReview(
      actorUserId,
      reviewId,
    );
    res
      .status(200)
      .json(
        successResponse(review, "Delivery partner review disabled successfully"),
      );
  } catch (err) {
    next(err);
  }
};
