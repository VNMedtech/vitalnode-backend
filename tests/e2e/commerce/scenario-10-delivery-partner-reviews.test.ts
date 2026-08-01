import { describe, expect, it } from "vitest";
import { getTestPrisma } from "../../utils/db.js";
import { deliveryPartnerReviewCreationPayload } from "../../fixtures/deliveryPartnerReview.payloads.js";
import {
  cartRequest,
  deliveryPartnerReviewRequest,
  orderRequest,
} from "../../utils/request.helpers.js";
import {
  fulfillOrderThroughDelivery,
  registerBuyerWithAddress,
  setupMarketplaceProduct,
  verifyPaymentForOrder,
} from "./helpers.js";
import { useCommerceE2ELifecycle } from "./setup.js";

describe("E2E Commerce — Scenario 10: Delivery Partner Reviews After Delivery", () => {
  const { getApp } = useCommerceE2ELifecycle();

  it("allows buyer to rate delivery, admin to approve comment, and partner to see stats + mine", async () => {
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
      `e2e-dp-review-checkout-${Date.now()}`,
    );
    expect(checkoutRes.status).toBe(201);
    const orderId = checkoutRes.body.data.orderId as string;

    await verifyPaymentForOrder(app, buyer.buyerToken, orderId);

    const partner = await fulfillOrderThroughDelivery(
      app,
      {
        orderId,
        adminToken: marketplace.adminToken,
        sellerToken: marketplace.sellerToken,
      },
      prisma,
    );

    const createRes = await deliveryPartnerReviewRequest(
      app,
      buyer.buyerToken,
    ).create(
      deliveryPartnerReviewCreationPayload(orderId, {
        rating: 5,
        comment: "Partner handled the delivery carefully.",
      }),
    );
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.commentStatus).toBe("PENDING");
    expect(createRes.body.data.deliveryPartnerId).toBe(
      partner.deliveryPartnerId,
    );
    const reviewId = createRes.body.data.id as string;

    const statsPending = await orderRequest(
      app,
      partner.deliveryPartnerToken,
    ).getAssignedStats();
    expect(statsPending.status).toBe(200);
    expect(statsPending.body.data.rating).toBe(5);
    expect(statsPending.body.data.ratingCount).toBe(1);

    const minePending = await deliveryPartnerReviewRequest(
      app,
      partner.deliveryPartnerToken,
    ).listMine();
    expect(minePending.status).toBe(200);
    expect(minePending.body.data).toHaveLength(1);
    expect(minePending.body.data[0].rating).toBe(5);
    expect(minePending.body.data[0].comment).toBeNull();
    expect(minePending.body.data[0].order.id).toBe(orderId);

    const approveRes = await deliveryPartnerReviewRequest(
      app,
      marketplace.adminToken,
    ).approve(reviewId);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.commentStatus).toBe("APPROVED");

    const mineApproved = await deliveryPartnerReviewRequest(
      app,
      partner.deliveryPartnerToken,
    ).listMine();
    expect(mineApproved.status).toBe(200);
    expect(mineApproved.body.data).toHaveLength(1);
    expect(mineApproved.body.data[0].comment).toContain("carefully");
    expect(mineApproved.body.data[0].order.orderNumber).toBeTruthy();

    const duplicateRes = await deliveryPartnerReviewRequest(
      app,
      buyer.buyerToken,
    ).create(deliveryPartnerReviewCreationPayload(orderId));
    expect(duplicateRes.status).toBe(409);
  });
});
