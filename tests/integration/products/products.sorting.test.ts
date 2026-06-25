import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as s3Module from "../../../src/infrastructure/s3/index.js";
import { productCreationPayload } from "../../fixtures/product.payloads.js";
import {
  createCategoryViaApi,
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

interface SortableProductSeed {
  id: string;
  deliveryTime: number;
  pricing: string;
  productName: string;
}

async function seedSortableMarketplaceProducts(
  app: Express,
): Promise<{
  categoryId: string;
  products: SortableProductSeed[];
}> {
  const prisma = getTestPrisma();
  const { login: adminLogin } = await createAdminViaApi(app, prisma);
  const { category } = await createCategoryViaApi(
    app,
    adminLogin.auth.accessToken,
  );
  const seller = await createApprovedSeller(app, prisma);

  const seeds = [
    { deliveryTime: 2, pricing: "10000.00", productName: "Product A" },
    { deliveryTime: 2, pricing: "9000.00", productName: "Product B" },
    { deliveryTime: 5, pricing: "7000.00", productName: "Product C" },
    { deliveryTime: 1, pricing: "12000.00", productName: "Product D" },
    { deliveryTime: 1, pricing: "11000.00", productName: "Product E" },
  ];

  const products: SortableProductSeed[] = [];

  for (const seed of seeds) {
    const createRes = await productRequest(
      app,
      seller.login.auth.accessToken,
    ).create(
      productCreationPayload(category.id, {
        productName: seed.productName,
        deliveryTime: seed.deliveryTime,
        pricing: seed.pricing,
      }),
    );

    const productId = createRes.body.data.id as string;
    await productRequest(app, adminLogin.auth.accessToken).approve(productId);
    products.push({ id: productId, ...seed });
  }

  return { categoryId: category.id, products };
}

function expectedMarketplaceOrder(products: SortableProductSeed[]): string[] {
  return [...products]
    .sort((a, b) => {
      if (a.deliveryTime !== b.deliveryTime) {
        return a.deliveryTime - b.deliveryTime;
      }
      return Number(a.pricing) - Number(b.pricing);
    })
    .map((product) => product.id);
}

describe("Products — Marketplace sorting (SOW default)", () => {
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

  it("1. defaults to deliveryTime asc then price asc when no sort params are sent", async () => {
    const { products } = await seedSortableMarketplaceProducts(app);

    const res = await productRequest(app).listMarketplace();

    expect(res.status).toBe(200);
    expect(res.body.data.map((item: { id: string }) => item.id)).toEqual(
      expectedMarketplaceOrder(products),
    );
  });

  it("2. uses price as tiebreaker for equal delivery days", async () => {
    const { products } = await seedSortableMarketplaceProducts(app);
    const sameDelivery = products.filter((product) => product.deliveryTime === 2);

    const res = await productRequest(app).listMarketplace();

    const orderedSameDelivery = res.body.data
      .filter((item: { id: string }) =>
        sameDelivery.some((product) => product.id === item.id),
      )
      .map((item: { id: string }) => item.id);

    expect(orderedSameDelivery).toEqual([
      sameDelivery.find((product) => product.productName === "Product B")!.id,
      sameDelivery.find((product) => product.productName === "Product A")!.id,
    ]);
  });

  it("3. honors explicit price ascending sort", async () => {
    await seedSortableMarketplaceProducts(app);

    const res = await productRequest(app).listMarketplace({
      sortBy: "price",
      sortOrder: "asc",
    });

    const prices = res.body.data.map((item: { pricing: string }) =>
      Number(item.pricing),
    );
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("4. honors explicit newest descending sort", async () => {
    const { products } = await seedSortableMarketplaceProducts(app);

    const res = await productRequest(app).listMarketplace({
      sortBy: "newest",
      sortOrder: "desc",
    });

    const newestProduct = products.at(-1)!;
    expect(res.body.data[0].id).toBe(newestProduct.id);
  });

  it("5. keeps default sort with category filter", async () => {
    const { categoryId, products } = await seedSortableMarketplaceProducts(app);

    const res = await productRequest(app).listMarketplace({ categoryId });

    expect(res.body.data.map((item: { id: string }) => item.id)).toEqual(
      expectedMarketplaceOrder(products),
    );
  });

  it("6. keeps default sort with search filter", async () => {
    const { products } = await seedSortableMarketplaceProducts(app);

    const res = await productRequest(app).listMarketplace({ search: "Product" });

    expect(res.body.data.map((item: { id: string }) => item.id)).toEqual(
      expectedMarketplaceOrder(products),
    );
  });

  it("7. paginates consistently with default sort", async () => {
    const { products } = await seedSortableMarketplaceProducts(app);
    const expectedOrder = expectedMarketplaceOrder(products);

    const page1 = await productRequest(app).listMarketplace({ page: 1, limit: 2 });
    const page2 = await productRequest(app).listMarketplace({ page: 2, limit: 2 });
    const page3 = await productRequest(app).listMarketplace({ page: 3, limit: 2 });

    const combined = [
      ...page1.body.data,
      ...page2.body.data,
      ...page3.body.data,
    ].map((item: { id: string }) => item.id);

    expect(combined).toEqual(expectedOrder);
    expect(page1.body.meta.total).toBe(5);
    expect(page1.body.meta.totalPages).toBe(3);
  });

  it("8. excludes non-approved products from default sorted marketplace listing", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const seller = await createApprovedSeller(app, prisma);

    const approvedRes = await productRequest(
      app,
      seller.login.auth.accessToken,
    ).create(
      productCreationPayload(category.id, {
        productName: "Approved Product",
        deliveryTime: 3,
        pricing: "5000.00",
      }),
    );
    await productRequest(app, adminLogin.auth.accessToken).approve(
      approvedRes.body.data.id,
    );

    await productRequest(app, seller.login.auth.accessToken).create(
      productCreationPayload(category.id, {
        productName: "Pending Product",
        deliveryTime: 1,
        pricing: "1000.00",
      }),
    );

    const res = await productRequest(app).listMarketplace();

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(approvedRes.body.data.id);
  });
});
