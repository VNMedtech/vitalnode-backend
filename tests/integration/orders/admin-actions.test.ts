import { describe, expect, it } from "vitest";
import {
  createDeliveryPartnerDirect,
  resolveSellerPickupAddressId,
  setFulfillmentMethodAsAdmin,
  setupAssignedOrder,
  setupOrderTestContext,
  setupOutForDeliveryOrder,
  setupThirdPartyShippedOrder,
  TEST_TRACKING_URL,
} from "../../factories/order.factory.js";
import { assignDeliveryPartnerPayload } from "../../fixtures/order.payloads.js";
import { getTestPrisma } from "../../utils/db.js";
import { newIdempotencyKey } from "../../utils/payment.helpers.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { useOrdersTestLifecycle } from "./setup.js";

describe("Orders — Section 4: Admin Actions", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("assigns a delivery partner after admin sets INTERNAL_DP", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const partner = await createDeliveryPartnerDirect(app, prisma);
    const pickupAddressId = await resolveSellerPickupAddressId(
      app,
      context.sellerToken,
    );

    await orderRequest(app, context.sellerToken).confirm(context.orderId, {
      pickupAddressId,
    });

    await setFulfillmentMethodAsAdmin(
      app,
      context.adminToken,
      context.orderId,
      "INTERNAL_DP",
    );

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
    expect(res.body.message).toMatch(/fulfillment method/i);
  });

  it("rejects assign before fulfillment method is set", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const partner = await createDeliveryPartnerDirect(app, prisma);
    const pickupAddressId = await resolveSellerPickupAddressId(
      app,
      context.sellerToken,
    );

    await orderRequest(app, context.sellerToken).confirm(context.orderId, {
      pickupAddressId,
    });

    const res = await orderRequest(app, context.adminToken).assignDeliveryPartner(
      context.orderId,
      assignDeliveryPartnerPayload(partner.deliveryPartnerId),
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/fulfillment method/i);
  });

  it("rejects assign for THIRD_PARTY shipments", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const partner = await createDeliveryPartnerDirect(app, prisma);
    const pickupAddressId = await resolveSellerPickupAddressId(
      app,
      context.sellerToken,
    );

    await orderRequest(app, context.sellerToken).confirm(context.orderId, {
      pickupAddressId,
    });
    await setFulfillmentMethodAsAdmin(
      app,
      context.adminToken,
      context.orderId,
      "THIRD_PARTY",
    );

    const res = await orderRequest(app, context.adminToken).assignDeliveryPartner(
      context.orderId,
      assignDeliveryPartnerPayload(partner.deliveryPartnerId),
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/INTERNAL_DP/i);
  });

  it("sets fulfillment method on confirmed order without shipment", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const pickupAddressId = await resolveSellerPickupAddressId(
      app,
      context.sellerToken,
    );

    await orderRequest(app, context.sellerToken).confirm(context.orderId, {
      pickupAddressId,
    });

    const res = await orderRequest(
      app,
      context.adminToken,
    ).switchFulfillmentMethod(context.orderId, {
      fulfillmentMethod: "THIRD_PARTY",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.shipment).toEqual(
      expect.objectContaining({
        method: "THIRD_PARTY",
        bookingSource: "MANUAL",
        status: "CREATED",
      }),
    );

    const shipment = await prisma.shipment.findUnique({
      where: { orderId: context.orderId },
    });
    expect(shipment?.method).toBe("THIRD_PARTY");
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

  it("admin can confirm a stuck PLACED order (warehouse only)", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const pickupAddressId = await resolveSellerPickupAddressId(
      app,
      context.sellerToken,
    );

    const res = await orderRequest(app, context.adminToken).confirm(
      context.orderId,
      { pickupAddressId },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("CONFIRMED");
    expect(res.body.data.shipment).toBeNull();
  });

  it("admin can switch fulfillment method while CONFIRMED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.adminToken,
    ).switchFulfillmentMethod(context.orderId, {
      fulfillmentMethod: "THIRD_PARTY",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.shipment.method).toBe("THIRD_PARTY");
    expect(res.body.data.shipment.bookingSource).toBe("MANUAL");
    expect(res.body.data.deliveryPartnerId).toBeNull();
    expect(res.body.data.shipment.deliveryPartnerId).toBeNull();
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

  it("saves tracking details on THIRD_PARTY order", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const pickupAddressId = await resolveSellerPickupAddressId(
      app,
      context.sellerToken,
    );

    await orderRequest(app, context.sellerToken).confirm(context.orderId, {
      pickupAddressId,
    });
    await setFulfillmentMethodAsAdmin(
      app,
      context.adminToken,
      context.orderId,
      "THIRD_PARTY",
    );

    const res = await orderRequest(app, context.adminToken).saveTracking(
      context.orderId,
      {
        carrier: "BlueDart",
        awbNumber: "BD123",
        trackingUrl: TEST_TRACKING_URL,
      },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.shipment).toEqual(
      expect.objectContaining({
        status: "BOOKED",
        trackingUrl: TEST_TRACKING_URL,
        carrier: "BlueDart",
        awbNumber: "BD123",
      }),
    );
  });

  it("marks THIRD_PARTY order delivered", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupThirdPartyShippedOrder(app, prisma);

    const res = await orderRequest(app, context.adminToken).markDelivered(
      context.orderId,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("PENDING_SETTLEMENT");
    expect(res.body.data.shipment.status).toBe("DELIVERED");
  });

  it("marks THIRD_PARTY order delivery failed", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupThirdPartyShippedOrder(app, prisma);

    const res = await orderRequest(app, context.adminToken).markDeliveryFailed(
      context.orderId,
      { reason: "Lost in transit" },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("DELIVERY_FAILED");
    expect(res.body.data.shipment.status).toBe("FAILED");
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
