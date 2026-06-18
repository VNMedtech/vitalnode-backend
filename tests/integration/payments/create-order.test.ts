/**
 * Shared cleanup: `resetDatabase()` in beforeEach truncates all tables CASCADE.
 * Razorpay mocks are restored via vitest.setup `vi.restoreAllMocks()`.
 */
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createRazorpayOrderForContext,
  setupPendingPaymentOrder,
} from "../../factories/payment.factory.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import {
  invalidOrderIdPayload,
  missingOrderIdPayload,
} from "../../fixtures/payment.payloads.js";
import { mockRazorpayLayer } from "../../mocks/razorpay.mock.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { newIdempotencyKey } from "../../utils/payment.helpers.js";
import { paymentRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Payments — Section 1: Razorpay Order Creation", () => {
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

  it("creates a Razorpay payment order for a pending checkout", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    const idempotencyKey = newIdempotencyKey("create-order");

    const res = await createRazorpayOrderForContext(
      app,
      context,
      idempotencyKey,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderId).toBe(context.orderId);
    expect(res.body.data.razorpayOrderId).toMatch(/^order_mock_/);
    expect(res.body.data.razorpayKeyId).toBe("rzp_test_mock_key_id");
    expect(res.body.data.currency).toBe("INR");
    expect(res.body.data.amount).toBeTruthy();

    const payment = await prisma.payment.findUnique({
      where: { orderId: context.orderId },
    });
    expect(payment?.razorpayOrderId).toBe(res.body.data.razorpayOrderId);
  });

  it("rejects order creation when Razorpay amount is invalid", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);

    await prisma.payment.update({
      where: { orderId: context.orderId },
      data: { amount: "0.50" },
    });

    const res = await createRazorpayOrderForContext(app, context);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it("rejects create-order when required metadata is missing", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);

    const missingBody = await paymentRequest(
      app,
      context.buyerAuth.accessToken,
    ).createOrder(missingOrderIdPayload() as { orderId: string }, newIdempotencyKey());
    expect(missingBody.status).toBe(400);
    expect(missingBody.body.message).toBe("Validation failed");

    const missingIdempotency = await paymentRequest(
      app,
      context.buyerAuth.accessToken,
    ).createOrderWithoutIdempotency({ orderId: context.orderId });
    expect(missingIdempotency.status).toBe(400);
    expect(missingIdempotency.body.message).toBe(
      "Idempotency-Key header is required",
    );

    const invalidOrderId = await paymentRequest(
      app,
      context.buyerAuth.accessToken,
    ).createOrder(
      invalidOrderIdPayload() as { orderId: string },
      newIdempotencyKey(),
    );
    expect(invalidOrderId.status).toBe(400);
  });

  it("rejects create-order for invalid or unauthorized user", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    const otherBuyer = await registerBuyerViaApi(app);

    const wrongBuyer = await paymentRequest(
      app,
      otherBuyer.auth.accessToken,
    ).createOrder({ orderId: context.orderId }, newIdempotencyKey());
    expect(wrongBuyer.status).toBe(404);

    const randomOrderId = "00000000-0000-4000-8000-000000000001";
    const notFound = await paymentRequest(
      app,
      context.buyerAuth.accessToken,
    ).createOrder({ orderId: randomOrderId }, newIdempotencyKey());
    expect(notFound.status).toBe(404);
  });

  it("returns cached response for duplicate idempotent create-order requests", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    const idempotencyKey = newIdempotencyKey("dup-create");

    const first = await createRazorpayOrderForContext(
      app,
      context,
      idempotencyKey,
    );
    const second = await createRazorpayOrderForContext(
      app,
      context,
      idempotencyKey,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);

    const razorpayOrders = await prisma.payment.findMany({
      where: { orderId: context.orderId },
    });
    expect(razorpayOrders).toHaveLength(1);
  });
});
