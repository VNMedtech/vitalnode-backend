import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as s3Module from "../../../src/infrastructure/s3/index.js";
import { deliveryPartnerReviewCreationPayload } from "../../fixtures/deliveryPartnerReview.payloads.js";
import { assignDeliveryPartnerPayload } from "../../fixtures/order.payloads.js";
import {
  ORDER_PROOF_FILE,
  createDeliveryPartnerDirect,
  setupAssignedOrder,
  setupDeliveredOrder,
} from "../../factories/order.factory.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { mockRazorpayLayer } from "../../mocks/razorpay.mock.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import {
  deliveryPartnerReviewRequest,
  orderRequest,
} from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

function mockS3Layer(): void {
  vi.spyOn(s3Module, "uploadObjectToS3").mockResolvedValue({
    key: "uploads/products/mock-file.png",
    bucket: "medical-test-bucket",
    etag: "mock-etag",
  });
  vi.spyOn(s3Module, "deleteObjectFromS3").mockResolvedValue(undefined);
  vi.spyOn(s3Module, "generateSignedDownloadUrl").mockResolvedValue(
    "https://signed.example.com/mock-file",
  );
}

describe("Delivery Partner Reviews — Buyer, Admin & Partner Workflows", () => {
  let app: Express;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetDatabase();
    mockRazorpayLayer();
    mockS3Layer();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("1. allows buyer to create a rating-only review after delivery", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);

    const res = await deliveryPartnerReviewRequest(
      app,
      delivered.buyerAuth.accessToken,
    ).create(
      deliveryPartnerReviewCreationPayload(delivered.orderId, {
        comment: undefined,
      }),
    );

    expect(res.status).toBe(201);
    expect(res.body.data.rating).toBe(5);
    expect(res.body.data.orderId).toBe(delivered.orderId);
    expect(res.body.data.deliveryPartnerId).toBe(
      delivered.deliveryPartner.deliveryPartnerId,
    );
    expect(res.body.data.comment).toBeNull();
    expect(res.body.data.commentStatus).toBeNull();
  });

  it("2. creates review with comment as PENDING", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);

    const res = await deliveryPartnerReviewRequest(
      app,
      delivered.buyerAuth.accessToken,
    ).create(deliveryPartnerReviewCreationPayload(delivered.orderId));

    expect(res.status).toBe(201);
    expect(res.body.data.comment).toContain("on time");
    expect(res.body.data.commentStatus).toBe("PENDING");
  });

  it("3. rejects rating when order is not delivered", async () => {
    const prisma = getTestPrisma();
    const assigned = await setupAssignedOrder(app, prisma);

    const res = await deliveryPartnerReviewRequest(
      app,
      assigned.buyerAuth.accessToken,
    ).create(deliveryPartnerReviewCreationPayload(assigned.orderId));

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("delivered");
  });

  it("4. rejects duplicate review for the same order", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);

    await deliveryPartnerReviewRequest(
      app,
      delivered.buyerAuth.accessToken,
    ).create(deliveryPartnerReviewCreationPayload(delivered.orderId));

    const res = await deliveryPartnerReviewRequest(
      app,
      delivered.buyerAuth.accessToken,
    ).create(
      deliveryPartnerReviewCreationPayload(delivered.orderId, {
        rating: 4,
        comment: "Second attempt",
      }),
    );

    expect(res.status).toBe(409);
  });

  it("5. rates the final delivery partner after reassignment", async () => {
    const prisma = getTestPrisma();
    const assigned = await setupAssignedOrder(app, prisma);
    const partnerB = await createDeliveryPartnerDirect(app, prisma);

    const reassignRes = await orderRequest(
      app,
      assigned.adminToken,
    ).reassignDeliveryPartner(
      assigned.orderId,
      assignDeliveryPartnerPayload(partnerB.deliveryPartnerId),
    );
    expect(reassignRes.status).toBe(200);

    const handoverRes = await orderRequest(
      app,
      assigned.sellerToken,
    ).uploadHandoverProof(assigned.orderId, ORDER_PROOF_FILE);
    expect(handoverRes.status).toBe(200);
    const shipRes = await orderRequest(app, assigned.sellerToken).markShipped(
      assigned.orderId,
    );
    expect(shipRes.status).toBe(200);
    await orderRequest(app, partnerB.deliveryPartnerToken).uploadDeliveryProof(
      assigned.orderId,
      ORDER_PROOF_FILE,
    );
    const deliveredRes = await orderRequest(
      app,
      partnerB.deliveryPartnerToken,
    ).markDelivered(assigned.orderId);
    expect(deliveredRes.status).toBe(200);

    const createRes = await deliveryPartnerReviewRequest(
      app,
      assigned.buyerAuth.accessToken,
    ).create(deliveryPartnerReviewCreationPayload(assigned.orderId));

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.deliveryPartnerId).toBe(
      partnerB.deliveryPartnerId,
    );
    expect(createRes.body.data.deliveryPartnerId).not.toBe(
      assigned.deliveryPartner.deliveryPartnerId,
    );
  });

  it("6. allows buyer to update and re-pends comment after approval", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);
    const createRes = await deliveryPartnerReviewRequest(
      app,
      delivered.buyerAuth.accessToken,
    ).create(deliveryPartnerReviewCreationPayload(delivered.orderId));
    const reviewId = createRes.body.data.id as string;

    const approveRes = await deliveryPartnerReviewRequest(
      app,
      delivered.adminToken,
    ).approve(reviewId);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.commentStatus).toBe("APPROVED");

    const updateRes = await deliveryPartnerReviewRequest(
      app,
      delivered.buyerAuth.accessToken,
    ).update(reviewId, {
      rating: 4,
      comment: "Updated feedback after follow-up",
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.rating).toBe(4);
    expect(updateRes.body.data.comment).toBe(
      "Updated feedback after follow-up",
    );
    expect(updateRes.body.data.commentStatus).toBe("PENDING");
  });

  it("7. allows admin to list, approve, and disable reviews", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);
    const createRes = await deliveryPartnerReviewRequest(
      app,
      delivered.buyerAuth.accessToken,
    ).create(deliveryPartnerReviewCreationPayload(delivered.orderId));
    const reviewId = createRes.body.data.id as string;

    const listRes = await deliveryPartnerReviewRequest(
      app,
      delivered.adminToken,
    ).listAdmin({ commentStatus: "PENDING" });
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].id).toBe(reviewId);

    const approveRes = await deliveryPartnerReviewRequest(
      app,
      delivered.adminToken,
    ).approve(reviewId);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.commentStatus).toBe("APPROVED");

    const disableRes = await deliveryPartnerReviewRequest(
      app,
      delivered.adminToken,
    ).disable(reviewId);
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.data.commentStatus).toBe("DISABLED");
  });

  it("8. partner mine list returns ratings immediately; comment text only when approved", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);
    const token = delivered.deliveryPartner.deliveryPartnerToken;

    const pendingRes = await deliveryPartnerReviewRequest(
      app,
      delivered.buyerAuth.accessToken,
    ).create(deliveryPartnerReviewCreationPayload(delivered.orderId));
    expect(pendingRes.status).toBe(201);

    let mineRes = await deliveryPartnerReviewRequest(app, token).listMine();
    expect(mineRes.status).toBe(200);
    expect(mineRes.body.data).toHaveLength(1);
    expect(mineRes.body.data[0].rating).toBe(5);
    expect(mineRes.body.data[0].comment).toBeNull();
    expect(mineRes.body.data[0].order.id).toBe(delivered.orderId);
    expect(mineRes.body.data[0].order.orderNumber).toBeTruthy();
    expect(mineRes.body.data[0].buyer).toBeUndefined();

    await deliveryPartnerReviewRequest(app, delivered.adminToken).approve(
      pendingRes.body.data.id as string,
    );

    mineRes = await deliveryPartnerReviewRequest(app, token).listMine();
    expect(mineRes.status).toBe(200);
    expect(mineRes.body.data).toHaveLength(1);
    expect(mineRes.body.data[0].comment).toContain("on time");
    expect(mineRes.body.data[0].rating).toBe(5);
  });

  it("8b. partner mine list includes rating-only reviews", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);
    const token = delivered.deliveryPartner.deliveryPartnerToken;

    const createRes = await deliveryPartnerReviewRequest(
      app,
      delivered.buyerAuth.accessToken,
    ).create(
      deliveryPartnerReviewCreationPayload(delivered.orderId, {
        rating: 4,
        comment: undefined,
      }),
    );
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.comment).toBeNull();

    const mineRes = await deliveryPartnerReviewRequest(app, token).listMine();
    expect(mineRes.status).toBe(200);
    expect(mineRes.body.data).toHaveLength(1);
    expect(mineRes.body.data[0].rating).toBe(4);
    expect(mineRes.body.data[0].comment).toBeNull();
    expect(mineRes.body.data[0].order.id).toBe(delivered.orderId);
  });

  it("9. disabled reviews are excluded from aggregates, mine list, and buyer updates", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);
    const partnerToken = delivered.deliveryPartner.deliveryPartnerToken;

    const createRes = await deliveryPartnerReviewRequest(
      app,
      delivered.buyerAuth.accessToken,
    ).create(deliveryPartnerReviewCreationPayload(delivered.orderId));
    const reviewId = createRes.body.data.id as string;

    await deliveryPartnerReviewRequest(app, delivered.adminToken).approve(
      reviewId,
    );
    await deliveryPartnerReviewRequest(app, delivered.adminToken).disable(
      reviewId,
    );

    const statsRes = await orderRequest(app, partnerToken).getAssignedStats();
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.rating).toBeNull();
    expect(statsRes.body.data.ratingCount).toBe(0);

    const mineRes = await deliveryPartnerReviewRequest(
      app,
      partnerToken,
    ).listMine();
    expect(mineRes.status).toBe(200);
    expect(mineRes.body.data).toHaveLength(0);

    const updateRes = await deliveryPartnerReviewRequest(
      app,
      delivered.buyerAuth.accessToken,
    ).update(reviewId, { rating: 2 });
    expect(updateRes.status).toBe(403);

    const recreateRes = await deliveryPartnerReviewRequest(
      app,
      delivered.buyerAuth.accessToken,
    ).create(
      deliveryPartnerReviewCreationPayload(delivered.orderId, {
        rating: 3,
        comment: "Trying again",
      }),
    );
    expect(recreateRes.status).toBe(403);
  });

  it("10. rejects create from seller and partner roles", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);
    const payload = deliveryPartnerReviewCreationPayload(delivered.orderId);

    const sellerRes = await deliveryPartnerReviewRequest(
      app,
      delivered.sellerToken,
    ).create(payload);
    expect(sellerRes.status).toBe(403);

    const partnerRes = await deliveryPartnerReviewRequest(
      app,
      delivered.deliveryPartner.deliveryPartnerToken,
    ).create(payload);
    expect(partnerRes.status).toBe(403);
  });

  it("11. clears comment and commentStatus when buyer removes comment", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);
    const createRes = await deliveryPartnerReviewRequest(
      app,
      delivered.buyerAuth.accessToken,
    ).create(deliveryPartnerReviewCreationPayload(delivered.orderId));
    const reviewId = createRes.body.data.id as string;

    const updateRes = await deliveryPartnerReviewRequest(
      app,
      delivered.buyerAuth.accessToken,
    ).update(reviewId, { comment: "" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.comment).toBeNull();
    expect(updateRes.body.data.commentStatus).toBeNull();
  });

  it("12. reflects ratings on assigned stats before disable", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);

    await deliveryPartnerReviewRequest(
      app,
      delivered.buyerAuth.accessToken,
    ).create(
      deliveryPartnerReviewCreationPayload(delivered.orderId, {
        rating: 4,
        comment: undefined,
      }),
    );

    const statsRes = await orderRequest(
      app,
      delivered.deliveryPartner.deliveryPartnerToken,
    ).getAssignedStats();

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.rating).toBe(4);
    expect(statsRes.body.data.ratingCount).toBe(1);
  });

  it("13. rejects rating when buyer does not own the order", async () => {
    const prisma = getTestPrisma();
    const buyer = await registerBuyerViaApi(app);
    const other = await setupDeliveredOrder(app, prisma);

    const res = await deliveryPartnerReviewRequest(
      app,
      buyer.auth.accessToken,
    ).create(deliveryPartnerReviewCreationPayload(other.orderId));

    expect(res.status).toBe(404);
  });
});
