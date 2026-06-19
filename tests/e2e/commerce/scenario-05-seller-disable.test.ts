import { describe, expect, it } from "vitest";
import { setupOrderTestContext } from "../../factories/order.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import {
  expectProductAbsentFromMarketplace,
  getSellerProfileId,
  setupMarketplaceProduct,
} from "./helpers.js";
import {
  orderRequest,
  productRequest,
  sellerRequest,
} from "../../utils/request.helpers.js";
import { useCommerceE2ELifecycle } from "./setup.js";

describe("E2E Commerce — Scenario 5: Seller Disable", () => {
  const { getApp } = useCommerceE2ELifecycle();

  it("hides seller products from marketplace while preserving existing order access", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const sellerProfileId = await getSellerProfileId(
      prisma,
      context.sellerUserId,
    );

    const listBefore = await productRequest(app).listMarketplace();
    expect(
      listBefore.body.data.some(
        (p: { id: string }) => p.id === context.productId,
      ),
    ).toBe(true);

    const disableRes = await sellerRequest(app, context.adminToken).disable(
      sellerProfileId,
      { reason: "E2E compliance review" },
    );
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.data.approvalStatus).toBe("DISABLED");

    const listAfter = await productRequest(app).listMarketplace();
    expectProductAbsentFromMarketplace(listAfter.body.data, context.productId);

    const detailRes = await productRequest(app).getMarketplaceById(
      context.productId,
    );
    expect(detailRes.status).toBe(404);

    // Existing order remains accessible to buyer
    const orderRes = await orderRequest(
      app,
      context.buyerAuth.accessToken,
    ).getById(context.orderId);
    expect(orderRes.status).toBe(200);
    expect(orderRes.body.data.orderStatus).toBe("PLACED");
    expect(orderRes.body.data.items).toHaveLength(1);

    const orderRecord = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(orderRecord?.orderStatus).toBe("PLACED");
  });

  it("blocks new purchases from disabled seller products", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const marketplace = await setupMarketplaceProduct(app, prisma);
    const sellerProfileId = await getSellerProfileId(
      prisma,
      marketplace.sellerUserId,
    );

    await sellerRequest(app, marketplace.adminToken).disable(sellerProfileId, {
      reason: "Suspended",
    });

    const listRes = await productRequest(app).listMarketplace();
    expectProductAbsentFromMarketplace(listRes.body.data, marketplace.productId);
  });
});
