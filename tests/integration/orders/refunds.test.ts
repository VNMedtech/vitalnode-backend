import { describe, expect, it } from "vitest";
import { setupOrderTestContext } from "../../factories/order.factory.js";
import { cancelOrderPayload } from "../../fixtures/order.payloads.js";
import { getTestPrisma } from "../../utils/db.js";
import {
  buildRefundProcessedWebhook,
  newIdempotencyKey,
  paymentWebhookRequest,
} from "../../utils/payment.helpers.js";
import { orderRequest, paymentRequest } from "../../utils/request.helpers.js";
import { createAdminActor } from "../../factories/payment.factory.js";
import { useOrdersTestLifecycle } from "./setup.js";

describe("Orders — Section 7: Refunds", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("triggers refund initiation when buyer cancels a paid order", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const cancelRes = await orderRequest(app, context.buyerAuth.accessToken).cancel(
      cancelOrderPayload(context.orderId, { reason: "Refund test" }),
      newIdempotencyKey("cancel-refund"),
    );
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.orderStatus).toBe("CANCELLED");

    const payment = await prisma.payment.findUnique({
      where: { orderId: context.orderId },
    });
    expect(payment?.refundStatus).toBe("PENDING");

    const refundAudit = await prisma.auditLog.findFirst({
      where: {
        action: "REFUND_INITIATED",
        entityId: payment?.id,
      },
    });
    expect(refundAudit).not.toBeNull();
  });

  it("completes refund via webhook and transitions order to REFUNDED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const adminToken = await createAdminActor(app, prisma);

    await orderRequest(app, context.buyerAuth.accessToken).cancel(
      cancelOrderPayload(context.orderId),
      newIdempotencyKey("cancel-for-webhook"),
    );

    await paymentRequest(app, adminToken).refund(
      { orderId: context.orderId },
      newIdempotencyKey("manual-refund"),
    );

    const webhookPayload = buildRefundProcessedWebhook({
      razorpayPaymentId: context.razorpayPaymentId,
      amountPaise: context.paymentAmountPaise,
    });
    const webhookRes = await paymentWebhookRequest(app, webhookPayload, {
      eventId: `evt-order-refund-${Date.now()}`,
    });
    expect(webhookRes.status).toBe(200);

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("REFUNDED");
  });

  it("prevents duplicate refund processing", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const adminToken = await createAdminActor(app, prisma);

    await orderRequest(app, context.buyerAuth.accessToken).cancel(
      cancelOrderPayload(context.orderId),
      newIdempotencyKey("cancel-dup-refund"),
    );

    const key = newIdempotencyKey("refund-dup");
    const first = await paymentRequest(app, adminToken).refund(
      { orderId: context.orderId },
      key,
    );
    const second = await paymentRequest(app, adminToken).refund(
      { orderId: context.orderId },
      key,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);

    await prisma.payment.update({
      where: { orderId: context.orderId },
      data: { refundStatus: "SUCCESS" },
    });

    const alreadyRefunded = await paymentRequest(app, adminToken).refund(
      { orderId: context.orderId },
      newIdempotencyKey("refund-already"),
    );
    expect(alreadyRefunded.status).toBe(200);
    expect(alreadyRefunded.body.data.alreadyCompleted).toBe(true);
  });
});
