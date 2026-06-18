import { describe, expect, it } from "vitest";
import { UserStatus } from "../../../src/shared/enums/userStatus.enum.js";
import {
  setupAssignedOrder,
  setupOrderTestContext,
} from "../../factories/order.factory.js";
import { invalidOrderUuid } from "../../fixtures/order.payloads.js";
import {
  createApprovedSeller,
  registerBuyerViaApi,
  setUserStatus,
} from "../../factories/user.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { newIdempotencyKey } from "../../utils/payment.helpers.js";
import { orderRequest } from "../../utils/request.helpers.js";
import {
  signInvalidAccessToken,
  tamperAccessToken,
} from "../../utils/jwt.helpers.js";
import { useOrdersTestLifecycle } from "./setup.js";

describe("Orders — Section 9: Security", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("rejects unauthenticated order access", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const listRes = await orderRequest(app).list();
    expect(listRes.status).toBe(401);

    const detailRes = await orderRequest(app).getById(context.orderId);
    expect(detailRes.status).toBe(401);
  });

  it("rejects invalid and tampered access tokens", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const invalidRes = await orderRequest(
      app,
      signInvalidAccessToken({ sub: "fake-user" }),
    ).getById(context.orderId);
    expect(invalidRes.status).toBe(401);

    const tamperedRes = await orderRequest(
      app,
      tamperAccessToken(context.buyerAuth.accessToken),
    ).getById(context.orderId);
    expect(tamperedRes.status).toBe(401);
  });

  it("enforces buyer ownership on order details", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const otherBuyer = await registerBuyerViaApi(app);

    const res = await orderRequest(
      app,
      otherBuyer.auth.accessToken,
    ).getById(context.orderId);

    expect(res.status).toBe(404);
  });

  it("enforces seller ownership on process endpoint", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);
    const otherSeller = await createApprovedSeller(app, prisma);

    const res = await orderRequest(
      app,
      otherSeller.login.auth.accessToken,
    ).process(context.orderId);

    expect(res.status).toBe(404);
  });

  it("rejects buyer from seller-only endpoints (RBAC)", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.buyerAuth.accessToken,
    ).process(context.orderId);

    expect(res.status).toBe(403);
  });

  it("rejects seller from admin assign-delivery endpoint (RBAC)", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const res = await orderRequest(
      app,
      context.sellerToken,
    ).assignDeliveryPartner(context.orderId, {
      deliveryPartnerId: invalidOrderUuid(),
    });

    expect(res.status).toBe(403);
  });

  it("rejects disabled buyer accounts", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    await setUserStatus(
      prisma,
      context.buyerAuth.user.id,
      UserStatus.DISABLED,
    );

    const res = await orderRequest(
      app,
      context.buyerAuth.accessToken,
    ).getById(context.orderId);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/disabled/i);
  });

  it("rejects delivery partner from cancelling orders", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.deliveryPartner.deliveryPartnerToken,
    ).cancelById(
      context.orderId,
      { reason: "Not allowed" },
      newIdempotencyKey("dp-cancel"),
    );

    expect(res.status).toBe(403);
  });
});
