import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createAdminActor,
  createRazorpayOrderForContext,
  setupPendingPaymentOrder,
} from "../../factories/payment.factory.js";
import { setUserStatus } from "../../factories/user.factory.js";
import { mockRazorpayLayer } from "../../mocks/razorpay.mock.js";
import { UserStatus } from "../../../src/shared/enums/userStatus.enum.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { newIdempotencyKey } from "../../utils/payment.helpers.js";
import { paymentRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";
import { signInvalidAccessToken, tamperAccessToken } from "../../utils/jwt.helpers.js";

describe("Payments — Section 5: Security", () => {
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

  it("rejects unauthenticated payment access", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);

    const createRes = await paymentRequest(app).createOrder(
      { orderId: context.orderId },
      newIdempotencyKey(),
    );
    expect(createRes.status).toBe(401);

    const detailsRes = await paymentRequest(app).getDetails(context.orderId);
    expect(detailsRes.status).toBe(401);
  });

  it("rejects invalid access tokens", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    const invalidToken = signInvalidAccessToken({ sub: "fake-user-id" });
    const tamperedToken = tamperAccessToken(context.buyerAuth.accessToken);

    const invalidRes = await paymentRequest(app, invalidToken).createOrder(
      { orderId: context.orderId },
      newIdempotencyKey(),
    );
    expect(invalidRes.status).toBe(401);

    const tamperedRes = await paymentRequest(app, tamperedToken).getDetails(
      context.orderId,
    );
    expect(tamperedRes.status).toBe(401);
  });

  it("rejects disabled users from payment endpoints", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);

    await setUserStatus(
      prisma,
      context.buyerAuth.user.id,
      UserStatus.DISABLED,
    );

    const res = await paymentRequest(app, context.buyerAuth.accessToken).createOrder(
      { orderId: context.orderId },
      newIdempotencyKey(),
    );

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Account is disabled");
  });

  it("prevents buyers from initiating admin-only refunds", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    await createRazorpayOrderForContext(app, context);

    const res = await paymentRequest(app, context.buyerAuth.accessToken).refund(
      { orderId: context.orderId },
      newIdempotencyKey("buyer-refund"),
    );

    expect(res.status).toBe(403);
  });

  it("prevents non-buyer roles from creating payment orders", async () => {
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);
    const adminToken = await createAdminActor(app, prisma);

    const res = await paymentRequest(app, adminToken).createOrder(
      { orderId: context.orderId },
      newIdempotencyKey(),
    );

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Buyer profile required");
  });
});
