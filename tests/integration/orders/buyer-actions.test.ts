import { describe, expect, it } from "vitest";
import { setupOrderTestContext } from "../../factories/order.factory.js";
import { cancelOrderPayload } from "../../fixtures/order.payloads.js";
import { getTestPrisma } from "../../utils/db.js";
import { newIdempotencyKey } from "../../utils/payment.helpers.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { useOrdersTestLifecycle } from "./setup.js";

describe("Orders — Section 2: Buyer Actions", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("lists orders for the authenticated buyer", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const res = await orderRequest(app, context.buyerAuth.accessToken).list();

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(context.orderId);
    expect(res.body.data[0].orderStatus).toBe("PLACED");
  });

  it("returns order details for the buyer who owns the order", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const res = await orderRequest(
      app,
      context.buyerAuth.accessToken,
    ).getById(context.orderId);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(context.orderId);
    expect(res.body.data.orderNumber).toBe(context.orderNumber);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.shippingAddressSnapshot).toBeTruthy();
    expect(res.body.data.shippingAddressSnapshot.city).toBe("Mumbai");
  });

  it("cancels a placed order via buyer cancel endpoint", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const res = await orderRequest(app, context.buyerAuth.accessToken).cancel(
      cancelOrderPayload(context.orderId, { reason: "Changed mind" }),
      newIdempotencyKey("buyer-cancel"),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("CANCELLED");

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("CANCELLED");
  });

  it("does not expose another buyer's orders in list", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    await setupOrderTestContext(app, prisma);
    const otherBuyer = await registerBuyerViaApi(app);

    const res = await orderRequest(app, otherBuyer.auth.accessToken).list();

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it("returns 404 when buyer requests another buyer's order details", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);
    const otherBuyer = await registerBuyerViaApi(app);

    const res = await orderRequest(
      app,
      otherBuyer.auth.accessToken,
    ).getById(context.orderId);

    expect(res.status).toBe(404);
  });
});
