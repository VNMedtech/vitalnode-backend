import { describe, expect, it } from "vitest";
import {
  createDeliveryPartnerDirect,
  setupOrderTestContext,
} from "../../factories/order.factory.js";
import { assignDeliveryPartnerPayload } from "../../fixtures/order.payloads.js";
import { getTestPrisma } from "../../utils/db.js";
import { newIdempotencyKey } from "../../utils/payment.helpers.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { useOrdersTestLifecycle } from "./setup.js";

describe("Orders — Section 4: Admin Actions", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("assigns a delivery partner to a placed order", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const partner = await createDeliveryPartnerDirect(app, prisma);

    const res = await orderRequest(app, context.adminToken).assignDeliveryPartner(
      context.orderId,
      assignDeliveryPartnerPayload(partner.deliveryPartnerId),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("ASSIGNED_DELIVERY_PARTNER");
    expect(res.body.data.deliveryPartnerId).toBe(partner.deliveryPartnerId);

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.deliveryPartnerId).toBe(partner.deliveryPartnerId);
  });

  it("reassigns delivery partner when order is already assigned", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const partnerA = await createDeliveryPartnerDirect(app, prisma);
    const partnerB = await createDeliveryPartnerDirect(app, prisma);

    await orderRequest(app, context.adminToken).assignDeliveryPartner(
      context.orderId,
      assignDeliveryPartnerPayload(partnerA.deliveryPartnerId),
    );

    const res = await orderRequest(
      app,
      context.adminToken,
    ).reassignDeliveryPartner(
      context.orderId,
      assignDeliveryPartnerPayload(partnerB.deliveryPartnerId),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.deliveryPartnerId).toBe(partnerB.deliveryPartnerId);
    expect(res.body.data.orderStatus).toBe("ASSIGNED_DELIVERY_PARTNER");
  });

  it("cancels an order as admin via cancel-by-id endpoint", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const res = await orderRequest(app, context.adminToken).cancelById(
      context.orderId,
      { reason: "Admin cancellation" },
      newIdempotencyKey("admin-cancel"),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("CANCELLED");

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("CANCELLED");
  });

  it("rejects delivery partner assignment from non-admin users", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const partner = await createDeliveryPartnerDirect(app, prisma);

    const res = await orderRequest(
      app,
      context.buyerAuth.accessToken,
    ).assignDeliveryPartner(
      context.orderId,
      assignDeliveryPartnerPayload(partner.deliveryPartnerId),
    );

    expect(res.status).toBe(403);
  });
});
