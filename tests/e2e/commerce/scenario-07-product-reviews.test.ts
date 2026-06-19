import { describe, expect, it } from "vitest";
import { getTestPrisma } from "../../utils/db.js";
import { reviewCreationPayload } from "../../fixtures/review.payloads.js";
import {
  cartRequest,
  orderRequest,
  productRequest,
  reviewRequest,
} from "../../utils/request.helpers.js";
import {
  fulfillOrderThroughDelivery,
  registerBuyerWithAddress,
  setupMarketplaceProduct,
  verifyPaymentForOrder,
} from "./helpers.js";
import { useCommerceE2ELifecycle } from "./setup.js";

describe("E2E Commerce — Scenario 7: Product Reviews After Delivery", () => {
  const { getApp } = useCommerceE2ELifecycle();

  it("allows buyer to review delivered product and reflects ratings on product detail", async () => {
    const app = getApp();
    const prisma = getTestPrisma();

    const marketplace = await setupMarketplaceProduct(app, prisma);
    const buyer = await registerBuyerWithAddress(app);

    await cartRequest(app, buyer.buyerToken).addItem({
      productId: marketplace.productId,
      quantity: 1,
    });

    const checkoutRes = await orderRequest(app, buyer.buyerToken).checkout(
      { shippingAddressId: buyer.addressId },
      `e2e-review-checkout-${Date.now()}`,
    );
    expect(checkoutRes.status).toBe(201);
    const orderId = checkoutRes.body.data.orderId as string;

    await verifyPaymentForOrder(app, buyer.buyerToken, orderId);

    await fulfillOrderThroughDelivery(
      app,
      {
        orderId,
        adminToken: marketplace.adminToken,
        sellerToken: marketplace.sellerToken,
      },
      prisma,
    );

    const createRes = await reviewRequest(app, buyer.buyerToken).create(
      reviewCreationPayload(marketplace.productId, {
        rating: 5,
        title: "Great purchase",
        comment: "Product quality met expectations after delivery.",
      }),
    );
    expect(createRes.status).toBe(201);

    const listRes = await productRequest(app).listReviews(marketplace.productId);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].title).toBe("Great purchase");

    const detailRes = await productRequest(app).getMarketplaceById(
      marketplace.productId,
    );
    expect(detailRes.body.data.reviewCount).toBe(1);
    expect(detailRes.body.data.averageRating).toBe("5.0");

    const duplicateRes = await reviewRequest(app, buyer.buyerToken).create(
      reviewCreationPayload(marketplace.productId),
    );
    expect(duplicateRes.status).toBe(409);
  });
});
