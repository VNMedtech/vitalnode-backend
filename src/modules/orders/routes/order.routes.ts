/**
 * @openapi
 * tags:
 *   - name: Orders
 *     description: Order lifecycle — checkout, fulfillment, cancellation, delivery
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  requireApprovedSeller,
  validate,
} from "../../../middlewares/index.js";
import { requireIdempotencyKey } from "../../../middlewares/idempotency.middleware.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import {
  optionalSingleFileUpload,
  singleFileUpload,
} from "../../uploads/middleware/upload.middleware.js";
import * as orderController from "../controllers/order.controller.js";
import { assignDeliveryPartnerBodySchema } from "../validators/assignDeliveryPartner.schema.js";
import {
  cancelOrderBodySchema,
  cancelOrderByIdBodySchema,
} from "../validators/cancelOrder.schema.js";
import { createOrderBodySchema } from "../validators/createOrder.schema.js";
import { orderIdParamSchema } from "../validators/orderParams.schema.js";
import { listOrdersQuerySchema } from "../validators/query.schema.js";
import { deliveryFailedBodySchema } from "../validators/updateOrderStatus.schema.js";

export const orderRouter = Router();

orderRouter.post(
  "/checkout",
  authenticate,
  authorizePermission(permissions.orders.create),
  requireIdempotencyKey,
  validate({ body: createOrderBodySchema }),
  orderController.checkout,
);

orderRouter.get(
  "/assigned",
  authenticate,
  authorizePermission(permissions.orders.read),
  validate({ query: listOrdersQuerySchema }),
  orderController.listAssignedOrders,
);

orderRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.orders.read),
  validate({ query: listOrdersQuerySchema }),
  orderController.listOrders,
);

orderRouter.post(
  "/cancel",
  authenticate,
  authorizePermission(permissions.orders.cancel),
  requireIdempotencyKey,
  validate({ body: cancelOrderBodySchema }),
  orderController.cancelOrder,
);

orderRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.orders.read),
  validate({ params: orderIdParamSchema }),
  orderController.getOrderDetails,
);

orderRouter.post(
  "/:id/process",
  authenticate,
  requireApprovedSeller,
  authorizePermission(permissions.orders.updateStatus),
  validate({ params: orderIdParamSchema }),
  orderController.processOrder,
);

orderRouter.post(
  "/:id/handover-proof",
  authenticate,
  requireApprovedSeller,
  authorizePermission(permissions.orders.updateStatus),
  singleFileUpload,
  validate({ params: orderIdParamSchema }),
  orderController.uploadHandoverProof,
);

orderRouter.post(
  "/:id/out-for-delivery",
  authenticate,
  requireApprovedSeller,
  authorizePermission(permissions.orders.updateStatus),
  optionalSingleFileUpload,
  validate({ params: orderIdParamSchema }),
  orderController.markOutForDelivery,
);

orderRouter.post(
  "/:id/delivery-proof",
  authenticate,
  authorizePermission(permissions.orders.updateStatus),
  singleFileUpload,
  validate({ params: orderIdParamSchema }),
  orderController.uploadDeliveryProof,
);

orderRouter.post(
  "/:id/delivered",
  authenticate,
  authorizePermission(permissions.orders.updateStatus),
  optionalSingleFileUpload,
  validate({ params: orderIdParamSchema }),
  orderController.markDelivered,
);

orderRouter.post(
  "/:id/delivery-failed",
  authenticate,
  authorizePermission(permissions.orders.updateStatus),
  validate({ params: orderIdParamSchema, body: deliveryFailedBodySchema }),
  orderController.markDeliveryFailed,
);

orderRouter.post(
  "/:id/assign-delivery-partner",
  authenticate,
  authorizePermission(permissions.orders.assignDelivery),
  validate({
    params: orderIdParamSchema,
    body: assignDeliveryPartnerBodySchema,
  }),
  orderController.assignDeliveryPartner,
);

orderRouter.post(
  "/:id/reassign-delivery-partner",
  authenticate,
  authorizePermission(permissions.orders.assignDelivery),
  validate({
    params: orderIdParamSchema,
    body: assignDeliveryPartnerBodySchema,
  }),
  orderController.reassignDeliveryPartner,
);

orderRouter.post(
  "/:id/cancel",
  authenticate,
  authorizePermission(permissions.orders.cancel),
  requireIdempotencyKey,
  validate({ params: orderIdParamSchema, body: cancelOrderByIdBodySchema }),
  orderController.cancelOrderById,
);
