import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { CouponService } from "../services/coupon.service.js";
import type {
  CouponIdParam,
  CreateCouponBody,
  ListCouponsQuery,
  UpdateCouponBody,
  ValidateCouponBody,
} from "../validators/coupon.schemas.js";

const service = new CouponService();

function requireUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.user?.id) throw new UnauthorizedError("Authentication required");
  return req.user.id;
}

export const listCoupons: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListCouponsQuery;
    const result = await service.list(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Coupons fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const getCoupon: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as CouponIdParam;
    const data = await service.getById(id);
    res.status(200).json(successResponse(data, "Coupon fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const createCoupon: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireUserId(req);
    const body = req.body as CreateCouponBody;
    const data = await service.create(actorUserId, body);
    res.status(201).json(successResponse(data, "Coupon created successfully"));
  } catch (err) {
    next(err);
  }
};

export const updateCoupon: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireUserId(req);
    const { id } = req.params as CouponIdParam;
    const body = req.body as UpdateCouponBody;
    const data = await service.update(actorUserId, id, body);
    res.status(200).json(successResponse(data, "Coupon updated successfully"));
  } catch (err) {
    next(err);
  }
};

export const validateCoupon: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireUserId(req);
    const body = req.body as ValidateCouponBody;
    const data = await service.validateForBuyer(actorUserId, body.code);
    res
      .status(200)
      .json(successResponse(data, "Coupon validated successfully"));
  } catch (err) {
    next(err);
  }
};
