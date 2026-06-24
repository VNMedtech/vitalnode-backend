import { describe, expect, it } from "vitest";
import {
  ORDER_PROOF_FILE,
  setupAssignedOrder,
  setupDeliveredOrder,
  setupOrderTestContext,
  setupOutForDeliveryOrder,
  setupProcessingOrder,
} from "../../factories/order.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { useOrdersTestLifecycle } from "./setup.js";

describe("Orders — Section 8: State Machine", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("follows happy path: PLACED → ASSIGNED → PROCESSING → OUT_FOR_DELIVERY → PENDING_SETTLEMENT", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupDeliveredOrder(app, prisma);

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("PENDING_SETTLEMENT");
  });

  it("allows PLACED → CANCELLED transition", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("PLACED");
  });

  it("rejects PROCESSING transition from PLACED (skipping assignment)", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const res = await orderRequest(app, context.sellerToken).process(
      context.orderId,
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/invalid order status transition/i);
  });

  it("rejects OUT_FOR_DELIVERY from PROCESSING without handover proof", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupProcessingOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.sellerToken,
    ).markOutForDelivery(context.orderId);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/handover proof/i);
  });

  it("rejects DELIVERED from OUT_FOR_DELIVERY without delivery proof", async () => {
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

  it("rejects cancellation when order is PROCESSING", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupProcessingOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.buyerAuth.accessToken,
    ).getById(context.orderId);

    expect(res.body.data.orderStatus).toBe("PROCESSING");

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("PROCESSING");
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
    expect(res.body.message).toMatch(/invalid order status transition/i);
  });

  it("rejects re-processing an order already in PROCESSING", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupProcessingOrder(app, prisma);

    const res = await orderRequest(app, context.sellerToken).process(
      context.orderId,
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/invalid order status transition/i);
  });

  it("rejects handover proof upload when order is not PROCESSING", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.sellerToken,
    ).uploadHandoverProof(context.orderId, ORDER_PROOF_FILE);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/processing/i);
  });
});
