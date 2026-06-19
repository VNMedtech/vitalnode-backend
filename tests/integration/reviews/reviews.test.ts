import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as s3Module from "../../../src/infrastructure/s3/index.js";
import { reviewCreationPayload } from "../../fixtures/review.payloads.js";
import { setupMarketplaceProduct } from "../../factories/commerce.factory.js";
import { setupDeliveredOrder } from "../../factories/order.factory.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { mockRazorpayLayer } from "../../mocks/razorpay.mock.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import {
  productRequest,
  reviewRequest,
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

describe("Reviews — Buyer & Admin Workflows", () => {
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

  it("1. allows buyer to create a review after delivery", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);
    const productId = delivered.productId;

    const res = await reviewRequest(app, delivered.buyerAuth.accessToken).create(
      reviewCreationPayload(productId),
    );

    expect(res.status).toBe(201);
    expect(res.body.data.rating).toBe(5);
    expect(res.body.data.productId).toBe(productId);
  });

  it("2. rejects review when order is not delivered", async () => {
    const prisma = getTestPrisma();
    const marketplace = await setupMarketplaceProduct(app, prisma);
    const buyer = await registerBuyerViaApi(app);

    const res = await reviewRequest(app, buyer.auth.accessToken).create(
      reviewCreationPayload(marketplace.productId),
    );

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("delivered");
  });

  it("3. rejects duplicate review for same buyer and product", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);

    await reviewRequest(app, delivered.buyerAuth.accessToken).create(
      reviewCreationPayload(delivered.productId),
    );

    const res = await reviewRequest(app, delivered.buyerAuth.accessToken).create(
      reviewCreationPayload(delivered.productId, { title: "Second attempt" }),
    );

    expect(res.status).toBe(409);
  });

  it("4. allows buyer to update and delete own review", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);
    const createRes = await reviewRequest(app, delivered.buyerAuth.accessToken).create(
      reviewCreationPayload(delivered.productId),
    );
    const reviewId = createRes.body.data.id as string;

    const updateRes = await reviewRequest(app, delivered.buyerAuth.accessToken).update(
      reviewId,
      { rating: 4, title: "Updated title" },
    );
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.rating).toBe(4);
    expect(updateRes.body.data.title).toBe("Updated title");

    const deleteRes = await reviewRequest(app, delivered.buyerAuth.accessToken).delete(
      reviewId,
    );
    expect(deleteRes.status).toBe(200);
  });

  it("5. lists active product reviews publicly", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);
    await reviewRequest(app, delivered.buyerAuth.accessToken).create(
      reviewCreationPayload(delivered.productId),
    );

    const res = await productRequest(app).listReviews(delivered.productId);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].rating).toBe(5);
  });

  it("6. exposes review aggregates on marketplace product detail", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);
    await reviewRequest(app, delivered.buyerAuth.accessToken).create(
      reviewCreationPayload(delivered.productId, { rating: 4 }),
    );

    const res = await productRequest(app).getMarketplaceById(
      delivered.productId,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.reviewCount).toBe(1);
    expect(res.body.data.averageRating).toBe("4.0");
  });

  it("7. allows admin to list and disable reviews", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);
    const createRes = await reviewRequest(app, delivered.buyerAuth.accessToken).create(
      reviewCreationPayload(delivered.productId),
    );
    const reviewId = createRes.body.data.id as string;

    const listRes = await reviewRequest(app, delivered.adminToken).listAdmin();
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    const disableRes = await reviewRequest(app, delivered.adminToken).disable(
      reviewId,
    );
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.data.status).toBe("DISABLED");

    const publicListRes = await productRequest(app).listReviews(
      delivered.productId,
    );
    expect(publicListRes.body.data).toHaveLength(0);

    const detailRes = await productRequest(app).getMarketplaceById(
      delivered.productId,
    );
    expect(detailRes.body.data.reviewCount).toBe(0);
  });

  it("8. rejects review creation from seller", async () => {
    const prisma = getTestPrisma();
    const delivered = await setupDeliveredOrder(app, prisma);

    const res = await reviewRequest(app, delivered.sellerToken).create(
      reviewCreationPayload(delivered.productId),
    );

    expect(res.status).toBe(403);
  });
});
