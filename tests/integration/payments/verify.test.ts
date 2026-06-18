import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createRazorpayOrderForContext,
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
import { paymentRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Payments — Section 2: Payment Verification", () => {
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

  it("verifies payment with a valid Razorpay signature", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    const createRes = await createRazorpayOrderForContext(app, context);
    const razorpayOrderId = createRes.body.data.razorpayOrderId as string;
    const razorpayPaymentId = randomRazorpayPaymentId();
    const razorpaySignature = createPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
    );

    const res = await paymentRequest(app, context.buyerAuth.accessToken).verify(
      { razorpayOrderId, razorpayPaymentId, razorpaySignature },
      newIdempotencyKey("verify"),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("PLACED");
    expect(res.body.data.paymentStatus).toBe("SUCCESS");
    expect(res.body.data.alreadyFulfilled).toBe(false);

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("PLACED");
  });

  it("rejects verification when signature is invalid", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    const createRes = await createRazorpayOrderForContext(app, context);
    const razorpayOrderId = createRes.body.data.razorpayOrderId as string;
    const razorpayPaymentId = randomRazorpayPaymentId();

    const res = await paymentRequest(app, context.buyerAuth.accessToken).verify(
      {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: "deadbeef".repeat(8),
      },
      newIdempotencyKey("verify-bad-sig"),
    );

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid payment signature");
  });

  it("rejects verification when signature is missing", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    const createRes = await createRazorpayOrderForContext(app, context);
    const razorpayOrderId = createRes.body.data.razorpayOrderId as string;

    const res = await paymentRequest(app, context.buyerAuth.accessToken).verify(
      {
        razorpayOrderId,
        razorpayPaymentId: randomRazorpayPaymentId(),
        razorpaySignature: "",
      },
      newIdempotencyKey("verify-missing-sig"),
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });

  it("rejects tampered verify payload where signature does not match body", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    const createRes = await createRazorpayOrderForContext(app, context);
    const razorpayOrderId = createRes.body.data.razorpayOrderId as string;
    const signedPaymentId = randomRazorpayPaymentId();
    const tamperedPaymentId = randomRazorpayPaymentId();
    const razorpaySignature = createPaymentSignature(
      razorpayOrderId,
      signedPaymentId,
    );

    const res = await paymentRequest(app, context.buyerAuth.accessToken).verify(
      {
        razorpayOrderId,
        razorpayPaymentId: tamperedPaymentId,
        razorpaySignature,
      },
      newIdempotencyKey("verify-tampered"),
    );

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid payment signature");
  });
});
