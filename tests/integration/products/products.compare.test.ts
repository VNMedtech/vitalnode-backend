import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as s3Module from "../../../src/infrastructure/s3/index.js";
import { productCreationPayload } from "../../fixtures/product.payloads.js";
import {
  createCategoryViaApi,
  setupMarketplaceProduct,
} from "../../factories/commerce.factory.js";
import {
  createAdminViaApi,
  createApprovedSeller,
} from "../../factories/user.factory.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { productRequest } from "../../utils/request.helpers.js";
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

async function createSecondMarketplaceProduct(
  app: Express,
  categoryId: string,
  adminToken: string,
  sellerToken: string,
  overrides: Record<string, unknown> = {},
) {
  const createRes = await productRequest(app, sellerToken).create(
    productCreationPayload(categoryId, {
      productName: "Digital X-Ray System",
      brand: "GE Healthcare",
      model: "Definium 8000",
      productType: "Imaging System",
      pricing: "250000.00",
      moq: 2,
      color: "Gray",
      weight: "180.00",
      length: "200.00",
      warrantyPeriod: 36,
      returnTime: 30,
      deliveryTime: 14,
      ...overrides,
    }),
  );

  const productId = createRes.body.data.id as string;
  await productRequest(app, adminToken).approve(productId);

  return productId;
}

describe("Products — Compare Marketplace Products", () => {
  let app: Express;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetDatabase();
    mockS3Layer();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("1. compares two approved marketplace products side by side", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const secondProductId = await createSecondMarketplaceProduct(
      app,
      setup.categoryId,
      setup.adminToken,
      setup.sellerToken,
    );

    const res = await productRequest(app).compare([
      setup.productId,
      secondProductId,
    ]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.productIds).toEqual([
      setup.productId,
      secondProductId,
    ]);
    expect(res.body.data.products).toHaveLength(2);
    expect(res.body.data.products[0].id).toBe(setup.productId);
    expect(res.body.data.products[1].id).toBe(secondProductId);
    expect(res.body.data.products[1]).toMatchObject({
      productName: "Digital X-Ray System",
      brand: "GE Healthcare",
      model: "Definium 8000",
      productType: "Imaging System",
      color: "Gray",
      moq: 2,
      deliveryTime: 14,
    });

    const attributeKeys = res.body.data.attributes.map(
      (attribute: { key: string }) => attribute.key,
    );
    expect(attributeKeys).toEqual([
      "productName",
      "category",
      "brand",
      "model",
      "productType",
      "color",
      "weight",
      "length",
      "warrantyPeriod",
      "returnTime",
      "deliveryTime",
      "pricing",
      "moq",
    ]);
    expect(
      res.body.data.attributes.find(
        (attribute: { key: string }) => attribute.key === "pricing",
      )?.values,
    ).toEqual(["125000", "250000"]);
  });

  it("2. preserves requested product order in the comparison response", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const secondProductId = await createSecondMarketplaceProduct(
      app,
      setup.categoryId,
      setup.adminToken,
      setup.sellerToken,
    );

    const res = await productRequest(app).compare([
      secondProductId,
      setup.productId,
    ]);

    expect(res.status).toBe(200);
    expect(res.body.data.productIds).toEqual([
      secondProductId,
      setup.productId,
    ]);
    expect(res.body.data.products.map((product: { id: string }) => product.id)).toEqual([
      secondProductId,
      setup.productId,
    ]);
  });

  it("3. compares up to four approved marketplace products", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const productTwo = await createSecondMarketplaceProduct(
      app,
      setup.categoryId,
      setup.adminToken,
      setup.sellerToken,
      { productName: "Product Two" },
    );
    const productThree = await createSecondMarketplaceProduct(
      app,
      setup.categoryId,
      setup.adminToken,
      setup.sellerToken,
      { productName: "Product Three" },
    );
    const productFour = await createSecondMarketplaceProduct(
      app,
      setup.categoryId,
      setup.adminToken,
      setup.sellerToken,
      { productName: "Product Four" },
    );

    const res = await productRequest(app).compare([
      setup.productId,
      productTwo,
      productThree,
      productFour,
    ]);

    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(4);
    expect(res.body.data.attributes[0].values).toHaveLength(4);
  });

  it("4. rejects comparison with fewer than two products", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const res = await productRequest(app).compare([setup.productId]);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });

  it("5. rejects comparison with more than four products", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const extraProducts = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        createSecondMarketplaceProduct(
          app,
          setup.categoryId,
          setup.adminToken,
          setup.sellerToken,
          { productName: `Extra Product ${index + 1}` },
        ),
      ),
    );

    const res = await productRequest(app).compare([
      setup.productId,
      ...extraProducts,
    ]);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });

  it("6. rejects invalid product UUIDs", async () => {
    const res = await productRequest(app).compare([
      "not-a-uuid",
      "550e8400-e29b-41d4-a716-446655440000",
    ]);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });

  it("7. rejects duplicate product IDs", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const res = await productRequest(app).compare([
      setup.productId,
      setup.productId,
    ]);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });

  it("8. rejects unavailable products such as pending approval", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const seller = await createApprovedSeller(app, prisma);
    const pendingRes = await productRequest(
      app,
      seller.login.auth.accessToken,
    ).create(productCreationPayload(category.id));

    const res = await productRequest(app).compare([
      setup.productId,
      pendingRes.body.data.id,
    ]);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe(
      "One or more products are not available for comparison",
    );
  });

  it("9. rejects disabled products from comparison", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const secondProductId = await createSecondMarketplaceProduct(
      app,
      setup.categoryId,
      setup.adminToken,
      setup.sellerToken,
    );

    await productRequest(app, setup.sellerToken).disable(setup.productId);

    const res = await productRequest(app).compare([
      setup.productId,
      secondProductId,
    ]);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe(
      "One or more products are not available for comparison",
    );
  });

  it("10. rejects unknown product IDs", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const res = await productRequest(app).compare([
      setup.productId,
      "550e8400-e29b-41d4-a716-446655440099",
    ]);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe(
      "One or more products are not available for comparison",
    );
  });
});
