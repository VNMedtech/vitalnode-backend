import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PAYMENT_ACTIONS } from "../../../src/modules/payments/constants/payment.constants.js";
import {
  createAdminActor,
  createRazorpayOrderForContext,
  setupCancelledPaidOrder,
  setupPendingPaymentOrder,
} from "../../factories/payment.factory.js";
import { randomRazorpayPaymentId } from "../../fixtures/payment.payloads.js";
import { mockRazorpayLayer } from "../../mocks/razorpay.mock.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import {
  createPaymentSignature,
  newIdempotencyKey,
} from "../../utils/payment.helpers.js";
import { paymentRequest, orderRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Payments — Section 6: Audit Logging", () => {
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

  it("records audit entries across payment lifecycle events", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);

    const createRes = await createRazorpayOrderForContext(app, context);
    const razorpayOrderId = createRes.body.data.razorpayOrderId as string;
    const payment = await prisma.payment.findUnique({
      where: { orderId: context.orderId },
    });
    expect(payment).not.toBeNull();

    const orderCreatedAudit = await prisma.auditLog.findFirst({
      where: {
        action: PAYMENT_ACTIONS.ORDER_CREATED,
        entityId: payment!.id,
      },
    });
    expect(orderCreatedAudit).not.toBeNull();
    expect(orderCreatedAudit?.actorUserId).toBe(context.buyerAuth.user.id);

    const razorpayPaymentId = randomRazorpayPaymentId();
    const verifyRes = await paymentRequest(
      app,
      context.buyerAuth.accessToken,
    ).verify(
      {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: createPaymentSignature(
          razorpayOrderId,
          razorpayPaymentId,
        ),
      },
      newIdempotencyKey("verify-audit"),
    );
    expect(verifyRes.status).toBe(200);

    const successAudit = await prisma.auditLog.findFirst({
      where: {
        action: PAYMENT_ACTIONS.SUCCESS,
        entityId: payment!.id,
      },
    });
    expect(successAudit).not.toBeNull();

    const placedAudit = await prisma.auditLog.findFirst({
      where: {
        action: "ORDER_PLACED",
        entityId: context.orderId,
      },
    });
    expect(placedAudit).not.toBeNull();

    const inventoryAudit = await prisma.auditLog.findFirst({
      where: {
        action: "INVENTORY_DEDUCTED",
      },
    });
    expect(inventoryAudit).not.toBeNull();

    const cancelled = await orderRequest(
      app,
      context.buyerAuth.accessToken,
    ).cancel(
      { orderId: context.orderId, reason: "Audit test cancel" },
      newIdempotencyKey("cancel-audit"),
    );
    expect(cancelled.status).toBe(200);

    const refundInitiatedAudit = await prisma.auditLog.findFirst({
      where: {
        action: PAYMENT_ACTIONS.REFUND_INITIATED,
        entityId: payment!.id,
      },
    });
    expect(refundInitiatedAudit).not.toBeNull();
    expect(refundInitiatedAudit?.actorUserId).toBe(context.buyerAuth.user.id);
  });

  it("records refund failure audit when Razorpay refund fails", async () => {
    const prisma = getTestPrisma();
    const context = await setupCancelledPaidOrder(app, prisma);
    const adminToken = await createAdminActor(app, prisma);

    mockRazorpayLayer({
      onCreateRefund: async () => {
        throw new Error("Simulated Razorpay failure");
      },
    });

    await paymentRequest(app, adminToken).refund(
      { orderId: context.orderId },
      newIdempotencyKey("refund-fail-audit"),
    );

    const payment = await prisma.payment.findUnique({
      where: { orderId: context.orderId },
    });

    const failedAudit = await prisma.auditLog.findFirst({
      where: {
        action: PAYMENT_ACTIONS.REFUND_FAILED,
        entityId: payment?.id,
      },
    });
    expect(failedAudit).not.toBeNull();
  });
});
