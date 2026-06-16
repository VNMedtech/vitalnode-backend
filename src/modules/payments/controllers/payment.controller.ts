import type { RequestHandler } from "express";
import { getIdempotencyKey } from "../../../middlewares/idempotency.middleware.js";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { successResponse } from "../../../shared/responses/api.response.js";
import type { RazorpayWebhookPayload } from "../../../infrastructure/razorpay/index.js";
import { PaymentService } from "../services/payment.service.js";
import { PaymentWebhookService } from "../services/paymentWebhook.service.js";
import { RefundService } from "../services/refund.service.js";
import type { CreatePaymentOrderBody } from "../validators/createPaymentOrder.schema.js";
import type { RefundBody } from "../validators/refund.schema.js";
import type { PaymentOrderIdParam } from "../validators/paymentParams.schema.js";
import type { VerifyPaymentBody } from "../validators/verifyPayment.schema.js";
import type { WebhookBody } from "../validators/webhook.schema.js";

const paymentService = new PaymentService();
const paymentWebhookService = new PaymentWebhookService();
const refundService = new RefundService();

function requireAuthenticatedUser(req: Parameters<RequestHandler>[0]): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

function requireAuthenticatedActor(req: Parameters<RequestHandler>[0]): {
  id: string;
  role: UserRole;
} {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }

  return {
    id: req.user.id,
    role: req.user.role as UserRole,
  };
}

export const getPaymentDetails: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedActor(req);
    const { orderId } = req.params as PaymentOrderIdParam;
    const payment = await paymentService.getPaymentDetails(
      actor.id,
      actor.role,
      orderId,
    );
    res
      .status(200)
      .json(successResponse(payment, "Payment details fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const createPaymentOrder: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUser(req);
    const body = req.body as CreatePaymentOrderBody;
    const result = await paymentService.createRazorpayOrder(
      actorUserId,
      body,
      getIdempotencyKey(req),
    );
    res
      .status(200)
      .json(successResponse(result, "Razorpay order created successfully"));
  } catch (err) {
    next(err);
  }
};

export const verifyPayment: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUser(req);
    const body = req.body as VerifyPaymentBody;
    const result = await paymentService.verifyPayment(
      actorUserId,
      body,
      getIdempotencyKey(req),
    );
    res
      .status(200)
      .json(successResponse(result, "Payment verified successfully"));
  } catch (err) {
    next(err);
  }
};

export const handleWebhook: RequestHandler = async (req, res, next) => {
  try {
    const rawBody = req.rawBody ?? req.body;
    const rawBodyString =
      typeof rawBody === "string"
        ? rawBody
        : Buffer.isBuffer(rawBody)
          ? rawBody.toString("utf8")
          : JSON.stringify(req.body);

    const payload = (
      Buffer.isBuffer(rawBody)
        ? JSON.parse(rawBody.toString("utf8"))
        : typeof rawBody === "string"
          ? JSON.parse(rawBody)
          : req.body
    ) as WebhookBody;

    await paymentWebhookService.processWebhook({
      rawBody: rawBodyString,
      signature: req.headers["x-razorpay-signature"] as string | undefined,
      eventId: req.headers["x-razorpay-event-id"] as string | undefined,
      payload: payload as RazorpayWebhookPayload,
    });

    res.status(200).json(successResponse({ received: true }));
  } catch (err) {
    next(err);
  }
};

export const initiateRefund: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUser(req);
    const body = req.body as RefundBody;
    const result = await refundService.initiateRefund(
      actorUserId,
      body,
      getIdempotencyKey(req),
    );
    res
      .status(200)
      .json(successResponse(result, "Refund initiated successfully"));
  } catch (err) {
    next(err);
  }
};
