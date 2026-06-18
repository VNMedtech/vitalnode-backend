import { describe, expect, it } from "vitest";
import {
  ORDER_PROOF_FILE,
  setupAssignedOrder,
  setupOrderTestContext,
} from "../../factories/order.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { useOrdersTestLifecycle } from "./setup.js";

describe("Orders — Section 3: Seller Actions", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("marks an assigned order as processing", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    const res = await orderRequest(app, context.sellerToken).process(
      context.orderId,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("PROCESSING");

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("PROCESSING");
  });

  it("uploads handover proof while order is processing", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    await orderRequest(app, context.sellerToken).process(context.orderId);

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

  it("marks order out for delivery after handover proof", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    await orderRequest(app, context.sellerToken).process(context.orderId);
    await orderRequest(app, context.sellerToken).uploadHandoverProof(
      context.orderId,
      ORDER_PROOF_FILE,
    );

    const res = await orderRequest(
      app,
      context.sellerToken,
    ).markOutForDelivery(context.orderId);

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("OUT_FOR_DELIVERY");
  });

  it("rejects processing when delivery partner is not assigned", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const res = await orderRequest(app, context.sellerToken).process(
      context.orderId,
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/invalid order status transition/i);
  });

  it("rejects out-for-delivery without handover proof", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    await orderRequest(app, context.sellerToken).process(context.orderId);

    const res = await orderRequest(
      app,
      context.sellerToken,
    ).markOutForDelivery(context.orderId);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/handover proof/i);
  });
});
