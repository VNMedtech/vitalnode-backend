import { describe, expect, it } from "vitest";
import {
  ORDER_PROOF_FILE,
  resolveSellerPickupAddressId,
  setupAssignedOrder,
  setupDeliveredOrder,
  setupOrderTestContext,
  setupOutForDeliveryOrder,
  setupProcessingOrder,
  setupThirdPartyConfirmedOrder,
  TEST_TRACKING_URL,
} from "../../factories/order.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { newIdempotencyKey } from "../../utils/payment.helpers.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { useOrdersTestLifecycle } from "./setup.js";

describe("Orders — Section 8: State Machine", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("follows happy path: PLACED → CONFIRMED → SHIPPED → PENDING_SETTLEMENT", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupDeliveredOrder(app, prisma);

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("PENDING_SETTLEMENT");

    const shipment = await prisma.shipment.findUnique({
      where: { orderId: context.orderId },
    });
    expect(shipment?.method).toBe("INTERNAL_DP");
    expect(shipment?.status).toBe("DELIVERED");
  });

  it("allows THIRD_PARTY happy path without DP", async () => {
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
  });

  it("allows PLACED → CANCELLED and CONFIRMED → CANCELLED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const placed = await setupOrderTestContext(app, prisma);

    const placedCancel = await orderRequest(
      app,
      placed.buyerAuth.accessToken,
    ).cancel(
      { orderId: placed.orderId, reason: "Buyer cancel placed" },
      newIdempotencyKey("cancel-placed"),
    );
    expect(placedCancel.status).toBe(200);

    const confirmed = await setupAssignedOrder(app, prisma);
    const confirmedCancel = await orderRequest(
      app,
      confirmed.buyerAuth.accessToken,
    ).cancel(
      { orderId: confirmed.orderId, reason: "Buyer cancel confirmed" },
      newIdempotencyKey("cancel-confirmed"),
    );
    expect(confirmedCancel.status).toBe(200);
  });

  it("allows confirm without assigned delivery partner", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const pickupAddressId = await resolveSellerPickupAddressId(
      app,
      context.sellerToken,
    );

    const res = await orderRequest(app, context.sellerToken).confirm(
      context.orderId,
      { fulfillmentMethod: "INTERNAL_DP", pickupAddressId },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("CONFIRMED");
    expect(res.body.data.deliveryPartnerId).toBeNull();
  });

  it("rejects SHIPPED from CONFIRMED without handover proof (INTERNAL_DP)", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupProcessingOrder(app, prisma);

    const res = await orderRequest(app, context.sellerToken).markShipped(
      context.orderId,
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/handover proof/i);
  });

  it("rejects DELIVERED from SHIPPED without delivery proof (INTERNAL_DP)", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOutForDeliveryOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.deliveryPartner.deliveryPartnerToken,
    ).markDelivered(context.orderId);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/delivery proof/i);
  });

  it("leaves order CONFIRMED after seller confirm", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupProcessingOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.buyerAuth.accessToken,
    ).getById(context.orderId);

    expect(res.body.data.orderStatus).toBe("CONFIRMED");
  });

  it("rejects delivery partner assignment when order is already DELIVERED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupDeliveredOrder(app, prisma);

    const res = await orderRequest(app, context.adminToken).assignDeliveryPartner(
      context.orderId,
      { deliveryPartnerId: context.deliveryPartner.deliveryPartnerId },
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/CONFIRMED/i);
  });

  it("rejects re-confirming an order already in CONFIRMED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupProcessingOrder(app, prisma);
    const pickupAddressId = await resolveSellerPickupAddressId(
      app,
      context.sellerToken,
    );

    const res = await orderRequest(app, context.sellerToken).confirm(
      context.orderId,
      { fulfillmentMethod: "INTERNAL_DP", pickupAddressId },
    );

    expect(res.status).toBe(409);
  });

  it("rejects handover proof upload when order is not CONFIRMED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const res = await orderRequest(
      app,
      context.sellerToken,
    ).uploadHandoverProof(context.orderId, ORDER_PROOF_FILE);

    expect(res.status).toBe(409);
  });

  it("rejects method switch after SHIPPED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOutForDeliveryOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.sellerToken,
    ).switchFulfillmentMethod(context.orderId, {
      fulfillmentMethod: "THIRD_PARTY",
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/CONFIRMED/i);
  });
});
