import { describe, expect, it } from "vitest";
import {
  setupOutForDeliveryOrder,
  setupThirdPartyShippedOrder,
} from "../../factories/order.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { useOrdersTestLifecycle } from "./setup.js";

describe("Orders — Redeliver after DELIVERY_FAILED", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("admin redelivers THIRD_PARTY failed order back to CONFIRMED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupThirdPartyShippedOrder(app, prisma);

    const failRes = await orderRequest(
      app,
      context.adminToken,
    ).markDeliveryFailed(context.orderId, { reason: "Customer unavailable" });
    expect(failRes.status).toBe(200);
    expect(failRes.body.data.orderStatus).toBe("DELIVERY_FAILED");
    expect(failRes.body.data.deliveryAttempts).toEqual([
      expect.objectContaining({
        attemptNumber: 1,
        status: "FAILED",
        failureReason: "Customer unavailable",
        method: "THIRD_PARTY",
      }),
    ]);
    expect(failRes.body.data.deliveryAttempts[0].failedAt).toBeTruthy();

    const attempt1 = await prisma.deliveryAttempt.findFirst({
      where: { orderId: context.orderId, attemptNumber: 1 },
    });
    expect(attempt1).toEqual(
      expect.objectContaining({
        status: "FAILED",
        failureReason: "Customer unavailable",
        method: "THIRD_PARTY",
      }),
    );
    expect(attempt1?.failedAt).toBeTruthy();

    const redeliverRes = await orderRequest(
      app,
      context.adminToken,
    ).redeliver(context.orderId);

    expect(redeliverRes.status).toBe(200);
    expect(redeliverRes.body.data.orderStatus).toBe("CONFIRMED");
    expect(redeliverRes.body.data.deliveryPartnerId).toBeNull();
    expect(redeliverRes.body.data.shipment).toEqual(
      expect.objectContaining({
        method: "THIRD_PARTY",
        status: "CREATED",
        deliveryPartnerId: null,
        carrier: null,
        awbNumber: null,
        trackingUrl: null,
        failureReason: null,
      }),
    );
    expect(redeliverRes.body.data.deliveryAttempts).toHaveLength(2);
    expect(redeliverRes.body.data.deliveryAttempts[0]).toEqual(
      expect.objectContaining({
        attemptNumber: 1,
        status: "FAILED",
        failureReason: "Customer unavailable",
      }),
    );
    expect(redeliverRes.body.data.deliveryAttempts[1]).toEqual(
      expect.objectContaining({
        attemptNumber: 2,
        status: "IN_PROGRESS",
        method: "THIRD_PARTY",
        failureReason: null,
      }),
    );

    const attempts = await prisma.deliveryAttempt.findMany({
      where: { orderId: context.orderId },
      orderBy: { attemptNumber: "asc" },
    });
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toEqual(
      expect.objectContaining({
        attemptNumber: 1,
        status: "FAILED",
      }),
    );
    expect(attempts[1]).toEqual(
      expect.objectContaining({
        attemptNumber: 2,
        status: "IN_PROGRESS",
        method: "THIRD_PARTY",
        deliveryPartnerId: null,
        carrier: null,
        awb: null,
        trackingUrl: null,
      }),
    );

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: context.orderId,
        action: "ORDER_STATUS_CHANGED",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.metadata).toEqual(
      expect.objectContaining({
        previousStatus: "DELIVERY_FAILED",
        newStatus: "CONFIRMED",
        redeliver: true,
        attemptNumber: 2,
      }),
    );
  });

  it("rejects redeliver from non-admin actors", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupThirdPartyShippedOrder(app, prisma);

    await orderRequest(app, context.adminToken).markDeliveryFailed(
      context.orderId,
      { reason: "Failed" },
    );

    const sellerRes = await orderRequest(
      app,
      context.sellerToken,
    ).redeliver(context.orderId);
    expect(sellerRes.status).toBe(403);

    const buyerRes = await orderRequest(
      app,
      context.buyerAuth.accessToken,
    ).redeliver(context.orderId);
    expect(buyerRes.status).toBe(403);
  });

  it("rejects redeliver when order is not DELIVERY_FAILED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupThirdPartyShippedOrder(app, prisma);

    const shippedRes = await orderRequest(
      app,
      context.adminToken,
    ).redeliver(context.orderId);
    expect(shippedRes.status).toBe(409);

    const ofd = await setupOutForDeliveryOrder(app, prisma);
    const confirmedLikeRes = await orderRequest(
      app,
      ofd.adminToken,
    ).redeliver(ofd.orderId);
    expect(confirmedLikeRes.status).toBe(409);
  });

  it("rejects delivery partner redeliver on INTERNAL_DP failed order", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOutForDeliveryOrder(app, prisma);

    const failRes = await orderRequest(
      app,
      context.deliveryPartner.deliveryPartnerToken,
    ).markDeliveryFailed(context.orderId, { reason: "Address incomplete" });
    expect(failRes.status).toBe(200);

    const dpRes = await orderRequest(
      app,
      context.deliveryPartner.deliveryPartnerToken,
    ).redeliver(context.orderId);
    expect(dpRes.status).toBe(403);

    const adminRes = await orderRequest(
      app,
      context.adminToken,
    ).redeliver(context.orderId);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.orderStatus).toBe("CONFIRMED");
    expect(adminRes.body.data.shipment.method).toBe("INTERNAL_DP");
  });
});
