/**
 * @openapi
 * tags:
 *   - name: Coupons
 *     description: Admin coupon management and buyer coupon validation
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as couponController from "../controllers/coupon.controller.js";
import {
  couponIdParamSchema,
  createCouponBodySchema,
  listCouponsQuerySchema,
  updateCouponBodySchema,
  validateCouponBodySchema,
} from "../validators/coupon.schemas.js";

export const couponRouter = Router();

couponRouter.get(
  "/admin",
  authenticate,
  authorizePermission(permissions.coupons.read),
  validate({ query: listCouponsQuerySchema }),
  couponController.listCoupons,
);

couponRouter.get(
  "/admin/:id",
  authenticate,
  authorizePermission(permissions.coupons.read),
  validate({ params: couponIdParamSchema }),
  couponController.getCoupon,
);

couponRouter.post(
  "/admin",
  authenticate,
  authorizePermission(permissions.coupons.create),
  validate({ body: createCouponBodySchema }),
  couponController.createCoupon,
);

couponRouter.patch(
  "/admin/:id",
  authenticate,
  authorizePermission(permissions.coupons.update),
  validate({
    params: couponIdParamSchema,
    body: updateCouponBodySchema,
  }),
  couponController.updateCoupon,
);

couponRouter.post(
  "/validate",
  authenticate,
  authorizePermission(permissions.coupons.validate),
  validate({ body: validateCouponBodySchema }),
  couponController.validateCoupon,
);
