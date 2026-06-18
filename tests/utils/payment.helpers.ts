import { createHmac, randomUUID } from "node:crypto";
import request from "supertest";
import type { Express } from "express";
import type { RazorpayWebhookPayload } from "../../src/infrastructure/razorpay/razorpay.types.js";

const PAYMENTS_WEBHOOK_PATH = "/api/v1/payments/webhook";

export const TEST_RAZORPAY_KEY_SECRET =
  process.env.RAZORPAY_KEY_SECRET ?? "test_razorpay_key_secret_32chars!!";

export const TEST_RAZORPAY_WEBHOOK_SECRET =
  process.env.RAZORPAY_WEBHOOK_SECRET ?? "test_webhook_secret_32chars_ok!!";

export function createPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  secret = TEST_RAZORPAY_KEY_SECRET,
): string {
  return createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
}

export function signWebhookBody(
  rawBody: string,
  secret = TEST_RAZORPAY_WEBHOOK_SECRET,
): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function buildPaymentCapturedWebhook(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  event?: string;
}): RazorpayWebhookPayload {
  return {
    event: input.event ?? "payment.captured",
    payload: {
      payment: {
        entity: {
          id: input.razorpayPaymentId,
          order_id: input.razorpayOrderId,
          amount: input.amountPaise,
          status: "captured",
          currency: "INR",
        },
      },
    },
  };
}

export function buildRefundProcessedWebhook(input: {
  razorpayPaymentId: string;
  amountPaise: number;
  refundId?: string;
}): RazorpayWebhookPayload {
  return {
    event: "refund.processed",
    payload: {
      refund: {
        entity: {
          id: input.refundId ?? `rfnd_evt_${randomUUID().slice(0, 8)}`,
          payment_id: input.razorpayPaymentId,
          amount: input.amountPaise,
          status: "processed",
        },
      },
    },
  };
}

export function buildUnknownWebhookEvent(): RazorpayWebhookPayload {
  return {
    event: "subscription.activated",
    payload: {},
  };
}

export interface WebhookRequestOptions {
  signature?: string;
  eventId?: string;
  omitSignature?: boolean;
}

export function paymentWebhookRequest(
  app: Express,
  payload: RazorpayWebhookPayload,
  options: WebhookRequestOptions = {},
) {
  const rawBody = JSON.stringify(payload);
  return sendRawWebhook(app, rawBody, options);
}

export function sendRawWebhook(
  app: Express,
  rawBody: string,
  options: WebhookRequestOptions = {},
) {
  const signature =
    options.signature ??
    signWebhookBody(rawBody, TEST_RAZORPAY_WEBHOOK_SECRET);

  let req = request(app)
    .post(PAYMENTS_WEBHOOK_PATH)
    .set("Content-Type", "application/json");

  if (!options.omitSignature) {
    req = req.set("x-razorpay-signature", signature);
  }

  if (options.eventId) {
    req = req.set("x-razorpay-event-id", options.eventId);
  }

  return req.send(rawBody);
}

export function newIdempotencyKey(prefix = "pay"): string {
  return `${prefix}-${randomUUID()}`;
}
