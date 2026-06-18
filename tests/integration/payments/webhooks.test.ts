import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createRazorpayOrderForContext,
  setupPendingPaymentOrder,
} from "../../factories/payment.factory.js";
import { mockRazorpayLayer } from "../../mocks/razorpay.mock.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import {
  buildPaymentCapturedWebhook,
  buildRefundProcessedWebhook,
  buildUnknownWebhookEvent,
  paymentWebhookRequest,
  sendRawWebhook,
  signWebhookBody,
  TEST_RAZORPAY_WEBHOOK_SECRET,
} from "../../utils/payment.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Payments — Section 3: Webhooks", () => {
  let app: Express;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    mockRazorpayLayer();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("processes a valid payment.captured webhook", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    const createRes = await createRazorpayOrderForContext(app, context);
    const razorpayOrderId = createRes.body.data.razorpayOrderId as string;
    const razorpayPaymentId = `pay_webhook_${Date.now()}`;
    const eventId = `evt-captured-${Date.now()}`;

    const payload = buildPaymentCapturedWebhook({
      razorpayOrderId,
      razorpayPaymentId,
      amountPaise: context.paymentAmountPaise,
    });

    const res = await paymentWebhookRequest(app, payload, { eventId });

    expect(res.status).toBe(200);
    expect(res.body.data.received).toBe(true);

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("PLACED");
  });

  it("rejects webhooks with an invalid signature", async () => {
    const payload = buildUnknownWebhookEvent();

    const res = await paymentWebhookRequest(app, payload, {
      signature: "invalid-signature-value",
      eventId: `evt-invalid-${Date.now()}`,
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid webhook signature");
  });

  it("skips duplicate webhooks with the same event id", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    const createRes = await createRazorpayOrderForContext(app, context);
    const razorpayOrderId = createRes.body.data.razorpayOrderId as string;
    const razorpayPaymentId = `pay_dup_${Date.now()}`;
    const eventId = `evt-dup-${Date.now()}`;

    const payload = buildPaymentCapturedWebhook({
      razorpayOrderId,
      razorpayPaymentId,
      amountPaise: context.paymentAmountPaise,
    });

    const first = await paymentWebhookRequest(app, payload, { eventId });
    const second = await paymentWebhookRequest(app, payload, { eventId });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const events = await prisma.webhookEvent.findMany({
      where: { eventId },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.processedAt).not.toBeNull();
  });

  it("accepts replayed webhooks without duplicate fulfillment", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    const createRes = await createRazorpayOrderForContext(app, context);
    const razorpayOrderId = createRes.body.data.razorpayOrderId as string;
    const razorpayPaymentId = `pay_replay_${Date.now()}`;
    const eventId = `evt-replay-${Date.now()}`;
    const payload = buildPaymentCapturedWebhook({
      razorpayOrderId,
      razorpayPaymentId,
      amountPaise: context.paymentAmountPaise,
    });

    const first = await paymentWebhookRequest(app, payload, { eventId });
    const replay = await paymentWebhookRequest(app, payload, { eventId });

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("PLACED");
  });

  it("handles out-of-order webhooks without corrupting payment state", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    const createRes = await createRazorpayOrderForContext(app, context);
    const razorpayOrderId = createRes.body.data.razorpayOrderId as string;
    const razorpayPaymentId = `pay_ooo_${Date.now()}`;

    const refundFirst = buildRefundProcessedWebhook({
      razorpayPaymentId,
      amountPaise: context.paymentAmountPaise,
    });
    const refundRes = await paymentWebhookRequest(app, refundFirst, {
      eventId: `evt-refund-first-${Date.now()}`,
    });
    expect(refundRes.status).toBe(200);

    let order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("PENDING_PAYMENT");

    const capturePayload = buildPaymentCapturedWebhook({
      razorpayOrderId,
      razorpayPaymentId,
      amountPaise: context.paymentAmountPaise,
    });
    const captureRes = await paymentWebhookRequest(app, capturePayload, {
      eventId: `evt-capture-after-${Date.now()}`,
    });
    expect(captureRes.status).toBe(200);

    order = await prisma.order.findUnique({ where: { id: context.orderId } });
    expect(order?.orderStatus).toBe("PLACED");
  });

  it("accepts unknown webhook events without error", async () => {
    const payload = buildUnknownWebhookEvent();
    const res = await paymentWebhookRequest(app, payload, {
      eventId: `evt-unknown-${Date.now()}`,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.received).toBe(true);
  });

  it("rejects webhooks when signature header is missing", async () => {
    const payload = buildUnknownWebhookEvent();
    const res = await paymentWebhookRequest(app, payload, {
      omitSignature: true,
      eventId: `evt-no-sig-${Date.now()}`,
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Missing Razorpay webhook signature");
  });

  it("rejects tampered webhook payload bytes", async () => {
    const payload = buildPaymentCapturedWebhook({
      razorpayOrderId: "order_mock_tamper",
      razorpayPaymentId: "pay_tamper",
      amountPaise: 10000,
    });
    const rawBody = JSON.stringify(payload);
    const tamperedBody = rawBody.replace("10000", "99999");
    const validSignature = signWebhookBody(rawBody, TEST_RAZORPAY_WEBHOOK_SECRET);

    const res = await sendRawWebhook(app, tamperedBody, {
      signature: validSignature,
      eventId: `evt-tamper-${Date.now()}`,
    });

    expect(res.status).toBe(401);
  });
});
