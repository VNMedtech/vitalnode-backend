/**
 * @openapi
 * tags:
 *   - name: Payments
 *     description: Razorpay payment lifecycle
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { requireIdempotencyKey } from "../../../middlewares/idempotency.middleware.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as paymentController from "../controllers/payment.controller.js";
import { createPaymentOrderBodySchema } from "../validators/createPaymentOrder.schema.js";
import { paymentOrderIdParamSchema } from "../validators/paymentParams.schema.js";
import { refundBodySchema } from "../validators/refund.schema.js";
import { verifyPaymentBodySchema } from "../validators/verifyPayment.schema.js";

export const paymentRouter = Router();

/**
 * @openapi
 * /api/v1/payments/{orderId}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment details for an order
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Payment details
 */
paymentRouter.get(
  "/:orderId",
  authenticate,
  authorizePermission(permissions.payments.read),
  validate({ params: paymentOrderIdParamSchema }),
  paymentController.getPaymentDetails,
);

/**
 * @openapi
 * /api/v1/payments/create-order:
 *   post:
 *     tags: [Payments]
 *     summary: Create Razorpay order for checkout
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Razorpay order created
 */
paymentRouter.post(
  "/create-order",
  authenticate,
  authorizePermission(permissions.payments.create),
  requireIdempotencyKey,
  validate({ body: createPaymentOrderBodySchema }),
  paymentController.createPaymentOrder,
);

/**
 * @openapi
 * /api/v1/payments/verify:
 *   post:
 *     tags: [Payments]
 *     summary: Verify Razorpay payment signature and fulfill order
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpayOrderId, razorpayPaymentId, razorpaySignature]
 *             properties:
 *               razorpayOrderId: { type: string }
 *               razorpayPaymentId: { type: string }
 *               razorpaySignature: { type: string }
 *     responses:
 *       200:
 *         description: Payment verified
 */
paymentRouter.post(
  "/verify",
  authenticate,
  authorizePermission(permissions.payments.verify),
  requireIdempotencyKey,
  validate({ body: verifyPaymentBodySchema }),
  paymentController.verifyPayment,
);

/**
 * @openapi
 * /api/v1/payments/webhook:
 *   post:
 *     tags: [Payments]
 *     summary: Razorpay webhook endpoint
 *     description: Public endpoint secured by Razorpay HMAC signature.
 *     responses:
 *       200:
 *         description: Webhook accepted
 */
paymentRouter.post("/webhook", paymentController.handleWebhook);

/**
 * @openapi
 * /api/v1/payments/refund:
 *   post:
 *     tags: [Payments]
 *     summary: Initiate refund for cancelled order
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Refund initiated
 */
paymentRouter.post(
  "/refund",
  authenticate,
  authorizePermission(permissions.payments.refund),
  requireIdempotencyKey,
  validate({ body: refundBodySchema }),
  paymentController.initiateRefund,
);
