import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createRazorpayOrderForContext,
  setupPendingPaymentOrder,
} from "../../factories/payment.factory.js";
import { randomRazorpayPaymentId } from "../../fixtures/payment.payloads.js";
import { mockRazorpayLayer, type RazorpayMockHandles } from "../../mocks/razorpay.mock.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import {
  createPaymentSignature,
  newIdempotencyKey,
} from "../../utils/payment.helpers.js";
import { paymentRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Payments — Section 7: Idempotency", () => {
  let app: Express;
  let razorpayMock: RazorpayMockHandles;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    razorpayMock = mockRazorpayLayer();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("does not create duplicate payments when create-order is retried with the same key", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    const idempotencyKey = newIdempotencyKey("idem-create");

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
    expect(razorpayMock.createOrderSpy).toHaveBeenCalledTimes(1);

    const payments = await prisma.payment.findMany({
      where: { orderId: context.orderId },
    });
    expect(payments).toHaveLength(1);

    const idempotencyRows = await prisma.idempotencyKey.findMany({
      where: {
        key: idempotencyKey,
        route: "POST:/api/v1/payments/create-order",
      },
    });
    expect(idempotencyRows).toHaveLength(1);
    expect(idempotencyRows[0]?.status).toBe("COMPLETED");
  });

  it("reuses existing Razorpay order id when create-order is called with a new key", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);

    const first = await createRazorpayOrderForContext(
      app,
      context,
      newIdempotencyKey("idem-new-1"),
    );
    const second = await createRazorpayOrderForContext(
      app,
      context,
      newIdempotencyKey("idem-new-2"),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.razorpayOrderId).toBe(
      first.body.data.razorpayOrderId,
    );
    expect(razorpayMock.createOrderSpy).toHaveBeenCalledTimes(1);
  });

  it("does not double-fulfill payments when verify is retried with the same key", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    const createRes = await createRazorpayOrderForContext(app, context);
    const razorpayOrderId = createRes.body.data.razorpayOrderId as string;
    const razorpayPaymentId = randomRazorpayPaymentId();
    const razorpaySignature = createPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
    );
    const idempotencyKey = newIdempotencyKey("idem-verify");

    const first = await paymentRequest(app, context.buyerAuth.accessToken).verify(
      { razorpayOrderId, razorpayPaymentId, razorpaySignature },
      idempotencyKey,
    );
    const second = await paymentRequest(app, context.buyerAuth.accessToken).verify(
      { razorpayOrderId, razorpayPaymentId, razorpaySignature },
      idempotencyKey,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);

    const movements = await prisma.inventoryMovement.findMany({
      where: { referenceId: context.orderId },
    });
    expect(movements.length).toBeGreaterThan(0);

    const payment = await prisma.payment.findUnique({
      where: { orderId: context.orderId },
    });
    expect(payment?.paymentStatus).toBe("SUCCESS");
  });
});
