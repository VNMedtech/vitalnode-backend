import { describe, expect, it } from "vitest";
import { setupOrderTestContext } from "../../factories/order.factory.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { setupMarketplaceProduct } from "./helpers.js";
import {
  cartRequest,
  orderRequest,
  productRequest,
} from "../../utils/request.helpers.js";
import { useCommerceE2ELifecycle } from "./setup.js";

describe("E2E Commerce — Scenario 6: Product Disable", () => {
  const { getApp } = useCommerceE2ELifecycle();

  it("prevents adding a disabled product to cart while existing orders remain valid", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const disableRes = await productRequest(app, context.sellerToken).disable(
      context.productId,
    );
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.data.status).toBe("DISABLED");

    const listRes = await productRequest(app).listMarketplace();
    expect(
      listRes.body.data.some((p: { id: string }) => p.id === context.productId),
    ).toBe(false);

    const { auth: newBuyer } = await registerBuyerViaApi(app);
    const addRes = await cartRequest(app, newBuyer.accessToken).addItem({
      productId: context.productId,
      quantity: 1,
    });
    expect(addRes.status).toBe(404);
    expect(addRes.body.message).toMatch(/not found|unavailable/i);

    const orderRes = await orderRequest(
      app,
      context.buyerAuth.accessToken,
    ).getById(context.orderId);
    expect(orderRes.status).toBe(200);
    expect(orderRes.body.data.orderStatus).toBe("PLACED");
    expect(orderRes.body.data.items[0].productSnapshot).toBeTruthy();

    const orderRecord = await prisma.order.findUnique({
      where: { id: context.orderId },
      include: { items: true },
    });
    expect(orderRecord?.orderStatus).toBe("PLACED");
    expect(orderRecord?.items).toHaveLength(1);
  });

  it("hides disabled product from marketplace detail endpoint", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const marketplace = await setupMarketplaceProduct(app, prisma);

    await productRequest(app, marketplace.sellerToken).disable(
      marketplace.productId,
    );

    const detailRes = await productRequest(app).getMarketplaceById(
      marketplace.productId,
    );
    expect(detailRes.status).toBe(404);
  });
});
