import { describe, expect, it } from "vitest";
import {
  ORDER_PROOF_FILE,
  setupOutForDeliveryOrder,
} from "../../factories/order.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { useOrdersTestLifecycle } from "./setup.js";

describe("Orders — Section 5: Delivery Actions", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("lists orders assigned to the delivery partner", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOutForDeliveryOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.deliveryPartner.deliveryPartnerToken,
    ).listAssigned();

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: context.orderId }),
      ]),
    );
  });

  it("uploads delivery proof while order is out for delivery", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOutForDeliveryOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.deliveryPartner.deliveryPartnerToken,
    ).uploadDeliveryProof(context.orderId, ORDER_PROOF_FILE);

    expect(res.status).toBe(200);
    expect(res.body.data.proofs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ proofType: "DELIVERY" }),
      ]),
    );

    const proof = await prisma.orderProof.findFirst({
      where: { orderId: context.orderId, proofType: "DELIVERY" },
    });
    expect(proof).not.toBeNull();
  });

  it("marks order as delivered after delivery proof", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOutForDeliveryOrder(app, prisma);

    await orderRequest(
      app,
      context.deliveryPartner.deliveryPartnerToken,
    ).uploadDeliveryProof(context.orderId, ORDER_PROOF_FILE);

    const res = await orderRequest(
      app,
      context.deliveryPartner.deliveryPartnerToken,
    ).markDelivered(context.orderId);

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("DELIVERED");

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("DELIVERED");
  });

  it("does not list orders for unassigned delivery partners", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    await setupOutForDeliveryOrder(app, prisma);
    const otherBuyer = await registerBuyerViaApi(app);

    const res = await orderRequest(app, otherBuyer.auth.accessToken).listAssigned();

    expect(res.status).toBe(403);
  });
});
