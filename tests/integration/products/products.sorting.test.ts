import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCategoryViaApi,
  createTemplateViaApi,
} from "../../factories/commerce.factory.js";
import {
  createAdminViaApi,
  createApprovedSeller,
} from "../../factories/user.factory.js";
import { productCreationPayload } from "../../fixtures/product.payloads.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { inventoryRequest, productRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Products — Marketplace Sorting", () => {
  let app: Express;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  async function seedSortableMarketplaceProducts() {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const { template } = await createTemplateViaApi(
      app,
      adminLogin.auth.accessToken,
      [category.id],
    );
    const seller = await createApprovedSeller(app, prisma);

    const seeds = [
      { pricing: "10000.00", productName: "Product A" },
      { pricing: "9000.00", productName: "Product B" },
      { pricing: "7000.00", productName: "Product C" },
      { pricing: "12000.00", productName: "Product D" },
      { pricing: "11000.00", productName: "Product E" },
    ];

    const products: Array<{ id: string; pricing: string; productName: string }> =
      [];

    for (const seed of seeds) {
      const createRes = await productRequest(
        app,
        seller.login.auth.accessToken,
      ).create(
        productCreationPayload(category.id, {
          productName: seed.productName,
          pricing: seed.pricing,
        }),
      );
      const productId = createRes.body.data.id as string;
      await productRequest(app, adminLogin.auth.accessToken).attachTemplate(
        productId,
        { templateId: template.id },
      );
      await productRequest(app, adminLogin.auth.accessToken).approve(productId);
      await inventoryRequest(app, seller.login.auth.accessToken).update(
        productId,
        { availableQuantity: 10, reason: "Stock" },
        `sort-stock-${productId}`,
      );
      products.push({
        id: productId,
        pricing: seed.pricing,
        productName: seed.productName,
      });
    }

    return { categoryId: category.id, products };
  }

  it("1. defaults to pricing asc when no sort params are sent", async () => {
    const { products } = await seedSortableMarketplaceProducts();
    const res = await productRequest(app).listMarketplace();

    expect(res.status).toBe(200);
    const ids = res.body.data.map((item: { id: string }) => item.id);
    const expected = [...products]
      .sort((a, b) => Number(a.pricing) - Number(b.pricing))
      .map((p) => p.id);
    expect(ids).toEqual(expected);
  });

  it("2. sorts by price descending when requested", async () => {
    const { products } = await seedSortableMarketplaceProducts();
    const res = await productRequest(app).listMarketplace({
      sortBy: "price",
      sortOrder: "desc",
    });

    expect(res.status).toBe(200);
    const ids = res.body.data.map((item: { id: string }) => item.id);
    const expected = [...products]
      .sort((a, b) => Number(b.pricing) - Number(a.pricing))
      .map((p) => p.id);
    expect(ids).toEqual(expected);
  });

  it("3. filters marketplace listing by categoryId", async () => {
    const { categoryId, products } = await seedSortableMarketplaceProducts();
    const res = await productRequest(app).listMarketplace({ categoryId });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(products.length);
  });
});
