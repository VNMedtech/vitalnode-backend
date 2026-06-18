import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createAdminActor,
  setupCancelledPaidOrder,
} from "../../factories/payment.factory.js";
import { mockRazorpayLayer } from "../../mocks/razorpay.mock.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import {
  buildRefundProcessedWebhook,
  newIdempotencyKey,
  paymentWebhookRequest,
} from "../../utils/payment.helpers.js";
import { paymentRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Payments — Section 4: Refunds", () => {
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

  it("initiates a successful refund for a cancelled paid order", async () => {
    const prisma = getTestPrisma();
    const context = await setupCancelledPaidOrder(app, prisma);
    const adminToken = await createAdminActor(app, prisma);
    const idempotencyKey = newIdempotencyKey("refund");

    const initiateRes = await paymentRequest(app, adminToken).refund(
      { orderId: context.orderId },
      idempotencyKey,
    );

    expect(initiateRes.status).toBe(200);
    expect(initiateRes.body.data.refundStatus).toBe("PENDING");
    expect(initiateRes.body.data.alreadyCompleted).toBe(false);

    const payment = await prisma.payment.findUnique({
      where: { orderId: context.orderId },
    });
    expect(payment?.refundStatus).toBe("PENDING");

    const webhookPayload = buildRefundProcessedWebhook({
      razorpayPaymentId: context.razorpayPaymentId,
      amountPaise: context.paymentAmountPaise,
    });
    const webhookRes = await paymentWebhookRequest(app, webhookPayload, {
      eventId: `evt-refund-success-${Date.now()}`,
    });
    expect(webhookRes.status).toBe(200);

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("REFUNDED");

    const refreshedPayment = await prisma.payment.findUnique({
      where: { orderId: context.orderId },
    });
    expect(refreshedPayment?.refundStatus).toBe("SUCCESS");
  });

  it("returns cached response for duplicate refund idempotency keys", async () => {
    const prisma = getTestPrisma();
    const context = await setupCancelledPaidOrder(app, prisma);
    const adminToken = await createAdminActor(app, prisma);
    const idempotencyKey = newIdempotencyKey("refund-dup");

    const first = await paymentRequest(app, adminToken).refund(
      { orderId: context.orderId },
      idempotencyKey,
    );
    const second = await paymentRequest(app, adminToken).refund(
      { orderId: context.orderId },
      idempotencyKey,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });

  it("returns already completed when payment was already refunded", async () => {
    const prisma = getTestPrisma();
    const context = await setupCancelledPaidOrder(app, prisma);
    const adminToken = await createAdminActor(app, prisma);

    await paymentRequest(app, adminToken).refund(
      { orderId: context.orderId },
      newIdempotencyKey("refund-1"),
    );

    await prisma.payment.update({
      where: { orderId: context.orderId },
      data: { refundStatus: "SUCCESS" },
    });

    const res = await paymentRequest(app, adminToken).refund(
      { orderId: context.orderId },
      newIdempotencyKey("refund-2"),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.alreadyCompleted).toBe(true);
    expect(res.body.data.refundStatus).toBe("SUCCESS");
  });

  it("marks refund failed when Razorpay refund API fails", async () => {
    const prisma = getTestPrisma();
    const context = await setupCancelledPaidOrder(app, prisma);
    const adminToken = await createAdminActor(app, prisma);

    const { createRefundSpy } = mockRazorpayLayer({
      onCreateRefund: async () => {
        throw new Error("Razorpay refund declined");
      },
    });
    expect(createRefundSpy).toBeDefined();

    const res = await paymentRequest(app, adminToken).refund(
      { orderId: context.orderId },
      newIdempotencyKey("refund-fail"),
    );

    expect(res.status).toBe(500);

    const payment = await prisma.payment.findUnique({
      where: { orderId: context.orderId },
    });
    expect(payment?.refundStatus).toBe("FAILED");

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "REFUND_FAILED",
        entityId: payment?.id,
      },
    });
    expect(audit).not.toBeNull();
  });
});
