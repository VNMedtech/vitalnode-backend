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

/**
 * @openapi
 * /api/v1/orders/checkout:
 *   post:
 *     tags: [Orders]
 *     summary: Checkout cart into an order
 *     description: Buyer only. Creates an order from the authenticated buyer's cart.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shippingAddressId]
 *             properties:
 *               shippingAddressId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Idempotency conflict or cart unavailable
 */
orderRouter.post(
  "/checkout",
  authenticate,
  authorizePermission(permissions.orders.create),
  requireIdempotencyKey,
  validate({ body: createOrderBodySchema }),
  orderController.checkout,
);

/**
 * @openapi
 * /api/v1/orders/assigned:
 *   get:
 *     tags: [Orders]
 *     summary: List orders assigned to the delivery partner
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, placedAt, totalAmount]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - PENDING_PAYMENT
 *             - PAYMENT_FAILED
 *             - PLACED
 *             - ASSIGNED_DELIVERY_PARTNER
 *             - PROCESSING
 *             - OUT_FOR_DELIVERY
 *             - DELIVERED
 *             - PENDING_SETTLEMENT
 *             - SETTLED
 *             - DELIVERY_FAILED
 *             - CANCELLED
 *             - REFUNDED
 *       - in: query
 *         name: search
 *         schema: { type: string, maxLength: 120 }
 *     responses:
 *       200:
 *         description: Assigned orders listed successfully
 */
orderRouter.get(
  "/assigned",
  authenticate,
  authorizePermission(permissions.orders.read),
  validate({ query: listOrdersQuerySchema }),
  orderController.listAssignedOrders,
);

/**
 * @openapi
 * /api/v1/orders:
 *   get:
 *     tags: [Orders]
 *     summary: List orders for the current role
 *     description: Buyer, seller, or admin list scoped by permissions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, placedAt, totalAmount]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - PENDING_PAYMENT
 *             - PAYMENT_FAILED
 *             - PLACED
 *             - ASSIGNED_DELIVERY_PARTNER
 *             - PROCESSING
 *             - OUT_FOR_DELIVERY
 *             - DELIVERED
 *             - PENDING_SETTLEMENT
 *             - SETTLED
 *             - DELIVERY_FAILED
 *             - CANCELLED
 *             - REFUNDED
 *       - in: query
 *         name: search
 *         schema: { type: string, maxLength: 120 }
 *     responses:
 *       200:
 *         description: Orders listed successfully
 */
orderRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.orders.read),
  validate({ query: listOrdersQuerySchema }),
  orderController.listOrders,
);

/**
 * @openapi
 * /api/v1/orders/cancel:
 *   post:
 *     tags: [Orders]
 *     summary: Cancel an order by body orderId
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId: { type: string, format: uuid }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       409:
 *         description: Order cannot be cancelled in current status
 */
orderRouter.post(
  "/cancel",
  authenticate,
  authorizePermission(permissions.orders.cancel),
  requireIdempotencyKey,
  validate({ body: cancelOrderBodySchema }),
  orderController.cancelOrder,
);

/**
 * @openapi
 * /api/v1/orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Get order details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Order details fetched successfully
 *       404:
 *         description: Order not found
 */
orderRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.orders.read),
  validate({ params: orderIdParamSchema }),
  orderController.getOrderDetails,
);

/**
 * @openapi
 * /api/v1/orders/{id}/process:
 *   post:
 *     tags: [Orders]
 *     summary: Mark order as processing
 *     description: Approved seller only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Order marked as processing
 */
orderRouter.post(
  "/:id/process",
  authenticate,
  requireApprovedSeller,
  authorizePermission(permissions.orders.updateStatus),
  validate({ params: orderIdParamSchema }),
  orderController.processOrder,
);

/**
 * @openapi
 * /api/v1/orders/{id}/handover-proof:
 *   post:
 *     tags: [Orders]
 *     summary: Upload handover proof
 *     description: Approved seller only. Multipart image upload.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Handover proof uploaded successfully
 */
orderRouter.post(
  "/:id/handover-proof",
  authenticate,
  requireApprovedSeller,
  authorizePermission(permissions.orders.updateStatus),
  singleFileUpload,
  validate({ params: orderIdParamSchema }),
  orderController.uploadHandoverProof,
);

/**
 * @openapi
 * /api/v1/orders/{id}/out-for-delivery:
 *   post:
 *     tags: [Orders]
 *     summary: Mark order out for delivery
 *     description: Approved seller only. Optional multipart proof file.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Order marked out for delivery
 */
orderRouter.post(
  "/:id/out-for-delivery",
  authenticate,
  requireApprovedSeller,
  authorizePermission(permissions.orders.updateStatus),
  optionalSingleFileUpload,
  validate({ params: orderIdParamSchema }),
  orderController.markOutForDelivery,
);

/**
 * @openapi
 * /api/v1/orders/{id}/delivery-proof:
 *   post:
 *     tags: [Orders]
 *     summary: Upload delivery proof
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Delivery proof uploaded successfully
 */
orderRouter.post(
  "/:id/delivery-proof",
  authenticate,
  authorizePermission(permissions.orders.updateStatus),
  singleFileUpload,
  validate({ params: orderIdParamSchema }),
  orderController.uploadDeliveryProof,
);

/**
 * @openapi
 * /api/v1/orders/{id}/delivered:
 *   post:
 *     tags: [Orders]
 *     summary: Mark order as delivered
 *     description: Optional multipart proof file.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Order marked as delivered
 */
orderRouter.post(
  "/:id/delivered",
  authenticate,
  authorizePermission(permissions.orders.updateStatus),
  optionalSingleFileUpload,
  validate({ params: orderIdParamSchema }),
  orderController.markDelivered,
);

/**
 * @openapi
 * /api/v1/orders/{id}/delivery-failed:
 *   post:
 *     tags: [Orders]
 *     summary: Mark delivery as failed
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Delivery marked as failed
 */
orderRouter.post(
  "/:id/delivery-failed",
  authenticate,
  authorizePermission(permissions.orders.updateStatus),
  validate({ params: orderIdParamSchema, body: deliveryFailedBodySchema }),
  orderController.markDeliveryFailed,
);

/**
 * @openapi
 * /api/v1/orders/{id}/assign-delivery-partner:
 *   post:
 *     tags: [Orders]
 *     summary: Assign a delivery partner to an order
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deliveryPartnerId]
 *             properties:
 *               deliveryPartnerId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Delivery partner assigned successfully
 */
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

/**
 * @openapi
 * /api/v1/orders/{id}/reassign-delivery-partner:
 *   post:
 *     tags: [Orders]
 *     summary: Reassign a delivery partner on an order
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deliveryPartnerId]
 *             properties:
 *               deliveryPartnerId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Delivery partner reassigned successfully
 */
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

/**
 * @openapi
 * /api/v1/orders/{id}/cancel:
 *   post:
 *     tags: [Orders]
 *     summary: Cancel an order by path id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       409:
 *         description: Order cannot be cancelled in current status
 */
orderRouter.post(
  "/:id/cancel",
  authenticate,
  authorizePermission(permissions.orders.cancel),
  requireIdempotencyKey,
  validate({ params: orderIdParamSchema, body: cancelOrderByIdBodySchema }),
  orderController.cancelOrderById,
);
