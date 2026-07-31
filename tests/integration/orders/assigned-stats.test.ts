import type { Express } from "express";
import { describe, expect, it } from "vitest";
import {
  ORDER_PROOF_FILE,
  assignDeliveryPartnerToOrder,
  confirmOrderAsSeller,
  createDeliveryPartnerDirect,
  setFulfillmentMethodAsAdmin,
  setupAssignedOrder,
  setupDeliveredOrder,
  setupOrderTestContext,
  setupOutForDeliveryOrder,
} from "../../factories/order.factory.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { useOrdersTestLifecycle } from "./setup.js";

async function assignFreshOrderToPartner(
  app: Express,
  deliveryPartnerId: string,
) {
  const prisma = getTestPrisma();
  const context = await setupOrderTestContext(app, prisma);
  await confirmOrderAsSeller(app, context.sellerToken, context.orderId);
  await setFulfillmentMethodAsAdmin(
    app,
    context.adminToken,
    context.orderId,
    "INTERNAL_DP",
  );
  await assignDeliveryPartnerToOrder(
    app,
    context.adminToken,
    context.orderId,
    deliveryPartnerId,
  );
  return context;
}

describe("Orders — Delivery Partner Assigned Stats", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("returns zeros and null rating when partner has no assignments", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const partner = await createDeliveryPartnerDirect(app, prisma);

    const res = await orderRequest(
      app,
      partner.deliveryPartnerToken,
    ).getAssignedStats();

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "Delivery partner stats fetched successfully",
        data: {
          ongoing: 0,
          completed: 0,
          failed: 0,
          rating: null,
          ratingCount: null,
        },
      }),
    );
  });

  it("counts mixed ongoing, completed, and failed for the authenticated partner", async () => {
    const app = getApp();
    const prisma = getTestPrisma();

    const ongoingCtx = await setupAssignedOrder(app, prisma);
    const partnerId = ongoingCtx.deliveryPartner.deliveryPartnerId;
    const token = ongoingCtx.deliveryPartner.deliveryPartnerToken;

    const completedCtx = await assignFreshOrderToPartner(app, partnerId);
    const handoverRes = await orderRequest(
      app,
      completedCtx.sellerToken,
    ).uploadHandoverProof(completedCtx.orderId, ORDER_PROOF_FILE);
    expect(handoverRes.status).toBe(200);
    const shipRes = await orderRequest(
      app,
      completedCtx.sellerToken,
    ).markShipped(completedCtx.orderId);
    expect(shipRes.status).toBe(200);
    await orderRequest(app, token).uploadDeliveryProof(
      completedCtx.orderId,
      ORDER_PROOF_FILE,
    );
    const deliveredRes = await orderRequest(app, token).markDelivered(
      completedCtx.orderId,
    );
    expect(deliveredRes.status).toBe(200);

    const failedCtx = await assignFreshOrderToPartner(app, partnerId);
    const failHandover = await orderRequest(
      app,
      failedCtx.sellerToken,
    ).uploadHandoverProof(failedCtx.orderId, ORDER_PROOF_FILE);
    expect(failHandover.status).toBe(200);
    const failShip = await orderRequest(app, failedCtx.sellerToken).markShipped(
      failedCtx.orderId,
    );
    expect(failShip.status).toBe(200);
    const failRes = await orderRequest(app, token).markDeliveryFailed(
      failedCtx.orderId,
      { reason: "Customer unavailable" },
    );
    expect(failRes.status).toBe(200);

    const res = await orderRequest(app, token).getAssignedStats();

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      ongoing: 1,
      completed: 1,
      failed: 1,
      rating: null,
      ratingCount: null,
    });
  });

  it("does not include another partner's assignments in totals", async () => {
    const app = getApp();
    const prisma = getTestPrisma();

    const partnerA = await setupAssignedOrder(app, prisma);
    await setupAssignedOrder(app, prisma);

    const res = await orderRequest(
      app,
      partnerA.deliveryPartner.deliveryPartnerToken,
    ).getAssignedStats();

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      ongoing: 1,
      completed: 0,
      failed: 0,
      rating: null,
      ratingCount: null,
    });
  });

  it("updates completed count after mark delivered", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOutForDeliveryOrder(app, prisma);
    const token = context.deliveryPartner.deliveryPartnerToken;

    const before = await orderRequest(app, token).getAssignedStats();
    expect(before.status).toBe(200);
    expect(before.body.data.ongoing).toBe(1);
    expect(before.body.data.completed).toBe(0);

    await orderRequest(app, token).uploadDeliveryProof(
      context.orderId,
      ORDER_PROOF_FILE,
    );
    await orderRequest(app, token).markDelivered(context.orderId);

    const after = await orderRequest(app, token).getAssignedStats();
    expect(after.status).toBe(200);
    expect(after.body.data).toEqual({
      ongoing: 0,
      completed: 1,
      failed: 0,
      rating: null,
      ratingCount: null,
    });
  });

  it("rejects non–delivery-partner tokens", async () => {
    const app = getApp();
    await setupDeliveredOrder(app, getTestPrisma());
    const buyer = await registerBuyerViaApi(app);

    const res = await orderRequest(
      app,
      buyer.auth.accessToken,
    ).getAssignedStats();

    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated requests", async () => {
    const app = getApp();

    const res = await orderRequest(app).getAssignedStats();

    expect(res.status).toBe(401);
  });
});
