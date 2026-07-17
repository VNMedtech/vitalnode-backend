import { describe, expect, it } from "vitest";
import {
  ORDER_PROOF_FILE,
  setupAssignedOrder,
  setupOrderTestContext,
  setupThirdPartyConfirmedOrder,
  TEST_TRACKING_URL,
} from "../../factories/order.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { useOrdersTestLifecycle } from "./setup.js";

describe("Orders — Section 3: Seller Actions", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("confirms a placed order with INTERNAL_DP and creates shipment", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const res = await orderRequest(app, context.sellerToken).confirm(
      context.orderId,
      { fulfillmentMethod: "INTERNAL_DP" },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("CONFIRMED");
    expect(res.body.data.shipment).toEqual(
      expect.objectContaining({
        method: "INTERNAL_DP",
        status: "CREATED",
        deliveryPartnerId: null,
      }),
    );

    const shipment = await prisma.shipment.findUnique({
      where: { orderId: context.orderId },
    });
    expect(shipment?.method).toBe("INTERNAL_DP");
    expect(shipment?.status).toBe("CREATED");
  });

  it("confirms with THIRD_PARTY without a delivery partner", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const res = await orderRequest(app, context.sellerToken).confirm(
      context.orderId,
      { fulfillmentMethod: "THIRD_PARTY" },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("CONFIRMED");
    expect(res.body.data.deliveryPartnerId).toBeNull();
    expect(res.body.data.shipment).toEqual(
      expect.objectContaining({
        method: "THIRD_PARTY",
        bookingSource: "MANUAL",
        status: "CREATED",
      }),
    );
  });

  it("rejects confirm without fulfillmentMethod", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const res = await orderRequest(app, context.sellerToken).confirm(
      context.orderId,
      // @ts-expect-error intentional invalid body
      {},
    );

    expect(res.status).toBe(400);
  });

  it("exposes assigned delivery partner contact on seller order details", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    const res = await orderRequest(app, context.sellerToken).getById(
      context.orderId,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.deliveryPartnerId).toBe(
      context.deliveryPartner.deliveryPartnerId,
    );
    expect(res.body.data.shipment.deliveryPartnerId).toBe(
      context.deliveryPartner.deliveryPartnerId,
    );
    expect(res.body.data.deliveryPartner).toEqual(
      expect.objectContaining({
        id: context.deliveryPartner.deliveryPartnerId,
        firstName: "Delivery",
        lastName: "Partner",
        phoneNumber: expect.any(String),
      }),
    );
  });

  it("uploads handover proof while order is CONFIRMED (INTERNAL_DP)", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.sellerToken,
    ).uploadHandoverProof(context.orderId, ORDER_PROOF_FILE);

    expect(res.status).toBe(200);
    expect(res.body.data.proofs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ proofType: "HANDOVER" }),
      ]),
    );

    const proof = await prisma.orderProof.findFirst({
      where: { orderId: context.orderId, proofType: "HANDOVER" },
    });
    expect(proof).not.toBeNull();
  });

  it("marks INTERNAL_DP order shipped after handover proof", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    await orderRequest(app, context.sellerToken).uploadHandoverProof(
      context.orderId,
      ORDER_PROOF_FILE,
    );

    const res = await orderRequest(app, context.sellerToken).markShipped(
      context.orderId,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("SHIPPED");
    expect(res.body.data.shipment.status).toBe("OUT_FOR_DELIVERY");
  });

  it("rejects INTERNAL_DP mark-shipped without handover proof", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    const res = await orderRequest(app, context.sellerToken).markShipped(
      context.orderId,
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/handover proof/i);
  });

  it("rejects handover proof for THIRD_PARTY orders", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupThirdPartyConfirmedOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.sellerToken,
    ).uploadHandoverProof(context.orderId, ORDER_PROOF_FILE);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/internal delivery partner/i);
  });

  it("saves tracking and marks THIRD_PARTY order shipped", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupThirdPartyConfirmedOrder(app, prisma);

    const trackingRes = await orderRequest(app, context.sellerToken).saveTracking(
      context.orderId,
      { carrier: "BlueDart", awbNumber: "BD123", trackingUrl: TEST_TRACKING_URL },
    );
    expect(trackingRes.status).toBe(200);
    expect(trackingRes.body.data.shipment).toEqual(
      expect.objectContaining({
        status: "BOOKED",
        trackingUrl: TEST_TRACKING_URL,
        carrier: "BlueDart",
      }),
    );

    const shipRes = await orderRequest(app, context.sellerToken).markShipped(
      context.orderId,
    );
    expect(shipRes.status).toBe(200);
    expect(shipRes.body.data.orderStatus).toBe("SHIPPED");
    expect(shipRes.body.data.shipment.status).toBe("IN_TRANSIT");
  });

  it("rejects THIRD_PARTY mark-shipped without trackingUrl", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupThirdPartyConfirmedOrder(app, prisma);

    const res = await orderRequest(app, context.sellerToken).markShipped(
      context.orderId,
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/trackingUrl/i);
  });

  it("marks THIRD_PARTY order delivered without proof", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupThirdPartyConfirmedOrder(app, prisma);

    await orderRequest(app, context.sellerToken).saveTracking(context.orderId, {
      trackingUrl: TEST_TRACKING_URL,
    });
    await orderRequest(app, context.sellerToken).markShipped(context.orderId);

    const res = await orderRequest(app, context.sellerToken).markDelivered(
      context.orderId,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("PENDING_SETTLEMENT");
    expect(res.body.data.shipment.status).toBe("DELIVERED");
  });

  it("allows seller to mark THIRD_PARTY delivery failed", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupThirdPartyConfirmedOrder(app, prisma);

    await orderRequest(app, context.sellerToken).saveTracking(context.orderId, {
      trackingUrl: TEST_TRACKING_URL,
    });
    await orderRequest(app, context.sellerToken).markShipped(context.orderId);

    const res = await orderRequest(app, context.sellerToken).markDeliveryFailed(
      context.orderId,
      { reason: "Lost in transit" },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("DELIVERY_FAILED");
    expect(res.body.data.shipment.status).toBe("FAILED");
  });

  it("switches fulfillment method while CONFIRMED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.sellerToken,
    ).switchFulfillmentMethod(context.orderId, {
      fulfillmentMethod: "THIRD_PARTY",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.shipment.method).toBe("THIRD_PARTY");
    expect(res.body.data.shipment.bookingSource).toBe("MANUAL");
    expect(res.body.data.deliveryPartnerId).toBeNull();
    expect(res.body.data.shipment.deliveryPartnerId).toBeNull();
  });
});
