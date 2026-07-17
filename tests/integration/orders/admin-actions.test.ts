import { describe, expect, it } from "vitest";
import {
  createDeliveryPartnerDirect,
  setupAssignedOrder,
  setupOrderTestContext,
  setupOutForDeliveryOrder,
} from "../../factories/order.factory.js";
import { assignDeliveryPartnerPayload } from "../../fixtures/order.payloads.js";
import { getTestPrisma } from "../../utils/db.js";
import { newIdempotencyKey } from "../../utils/payment.helpers.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { useOrdersTestLifecycle } from "./setup.js";

describe("Orders — Section 4: Admin Actions", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("assigns a delivery partner after INTERNAL_DP confirm", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const partner = await createDeliveryPartnerDirect(app, prisma);

    await orderRequest(app, context.sellerToken).confirm(context.orderId, {
      fulfillmentMethod: "INTERNAL_DP",
    });

    const res = await orderRequest(app, context.adminToken).assignDeliveryPartner(
      context.orderId,
      assignDeliveryPartnerPayload(partner.deliveryPartnerId),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("CONFIRMED");
    expect(res.body.data.deliveryPartnerId).toBe(partner.deliveryPartnerId);
    expect(res.body.data.shipment).toEqual(
      expect.objectContaining({
        method: "INTERNAL_DP",
        status: "READY",
        deliveryPartnerId: partner.deliveryPartnerId,
      }),
    );
  });

  it("rejects assign on PLACED before confirm", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const partner = await createDeliveryPartnerDirect(app, prisma);

    const res = await orderRequest(app, context.adminToken).assignDeliveryPartner(
      context.orderId,
      assignDeliveryPartnerPayload(partner.deliveryPartnerId),
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/confirm/i);
  });

  it("rejects assign for THIRD_PARTY shipments", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const partner = await createDeliveryPartnerDirect(app, prisma);

    await orderRequest(app, context.sellerToken).confirm(context.orderId, {
      fulfillmentMethod: "THIRD_PARTY",
    });

    const res = await orderRequest(app, context.adminToken).assignDeliveryPartner(
      context.orderId,
      assignDeliveryPartnerPayload(partner.deliveryPartnerId),
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/INTERNAL_DP/i);
  });

  it("reassigns delivery partner while CONFIRMED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);
    const partnerB = await createDeliveryPartnerDirect(app, prisma);

    const res = await orderRequest(
      app,
      context.adminToken,
    ).reassignDeliveryPartner(
      context.orderId,
      assignDeliveryPartnerPayload(partnerB.deliveryPartnerId),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.deliveryPartnerId).toBe(partnerB.deliveryPartnerId);
    expect(res.body.data.shipment.deliveryPartnerId).toBe(
      partnerB.deliveryPartnerId,
    );
    expect(res.body.data.orderStatus).toBe("CONFIRMED");
  });

  it("rejects reassign after SHIPPED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOutForDeliveryOrder(app, prisma);
    const partnerB = await createDeliveryPartnerDirect(app, prisma);

    const res = await orderRequest(
      app,
      context.adminToken,
    ).reassignDeliveryPartner(
      context.orderId,
      assignDeliveryPartnerPayload(partnerB.deliveryPartnerId),
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/CONFIRMED/i);
  });

  it("admin can confirm a stuck PLACED order", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const res = await orderRequest(app, context.adminToken).confirm(
      context.orderId,
      { fulfillmentMethod: "THIRD_PARTY" },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("CONFIRMED");
    expect(res.body.data.shipment.method).toBe("THIRD_PARTY");
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
  });

  it("cancels a CONFIRMED order as admin", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    const res = await orderRequest(app, context.adminToken).cancelById(
      context.orderId,
      { reason: "Cancel after confirm" },
      newIdempotencyKey("admin-cancel-confirmed"),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("CANCELLED");
  });

  it("rejects cancel after SHIPPED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOutForDeliveryOrder(app, prisma);

    const res = await orderRequest(app, context.adminToken).cancelById(
      context.orderId,
      { reason: "Too late" },
      newIdempotencyKey("admin-cancel-shipped"),
    );

    expect(res.status).toBe(409);
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
