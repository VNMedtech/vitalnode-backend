import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCategoryViaApi,
  setupMarketplaceProduct,
} from "../../factories/commerce.factory.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { inventoryRequest, productRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Products — Compare", () => {
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

  it("compares marketplace products using core fields and all attribute keys", async () => {
    const prisma = getTestPrisma();
    const first = await setupMarketplaceProduct(app, prisma, {
      product: {
        productName: "Compare Product A",
        attributes: { color: "White", weight: 2 },
      },
    });
    const second = await setupMarketplaceProduct(app, prisma, {
      product: {
        productName: "Compare Product B",
        attributes: { color: "Black", weight: 3 },
      },
    });

    // Align categories so the set has a non-empty intersection
    await productRequest(app, second.sellerToken).update(second.productId, {
      categoryIds: [first.categoryId],
    });

    // Attach attributes after approval setup by seller update (attributes-only stays APPROVED)
    await productRequest(app, first.sellerToken).update(first.productId, {
      attributes: { color: "White", weight: 2 },
    });
    await productRequest(app, second.sellerToken).update(second.productId, {
      attributes: { color: "Black", weight: 3 },
    });

    const res = await productRequest(app).compare([
      first.productId,
      second.productId,
    ]);

    expect(res.status).toBe(200);
    expect(res.body.data.productIds).toEqual([
      first.productId,
      second.productId,
    ]);
    expect(res.body.data.products).toHaveLength(2);
    const keys = res.body.data.attributes.map(
      (row: { key: string }) => row.key,
    );
    expect(keys).toEqual(
      expect.arrayContaining(["productName", "brand", "pricing", "color", "weight"]),
    );
  });

  it("includes product-specific attributes after shared ones", async () => {
    const prisma = getTestPrisma();
    const first = await setupMarketplaceProduct(app, prisma, {
      product: { productName: "Union Product A" },
    });
    const second = await setupMarketplaceProduct(app, prisma, {
      product: { productName: "Union Product B" },
    });

    await productRequest(app, second.sellerToken).update(second.productId, {
      categoryIds: [first.categoryId],
    });

    await productRequest(app, first.sellerToken).update(first.productId, {
      attributes: { color: "White", voltage: "220V" },
    });
    await productRequest(app, second.sellerToken).update(second.productId, {
      attributes: { color: "Black", weight: 3 },
    });

    const res = await productRequest(app).compare([
      first.productId,
      second.productId,
    ]);

    expect(res.status).toBe(200);
    const keys = res.body.data.attributes.map(
      (row: { key: string }) => row.key,
    );
    const colorIdx = keys.indexOf("color");
    const voltageIdx = keys.indexOf("voltage");
    const weightIdx = keys.indexOf("weight");

    expect(colorIdx).toBeGreaterThan(-1);
    expect(voltageIdx).toBeGreaterThan(-1);
    expect(weightIdx).toBeGreaterThan(-1);
    // Shared keys appear before product-specific keys
    expect(colorIdx).toBeLessThan(voltageIdx);
    expect(colorIdx).toBeLessThan(weightIdx);

    const colorRow = res.body.data.attributes.find(
      (row: { key: string }) => row.key === "color",
    );
    const voltageRow = res.body.data.attributes.find(
      (row: { key: string }) => row.key === "voltage",
    );
    expect(colorRow.values).toEqual(["White", "Black"]);
    expect(voltageRow.values[0]).toBe("220V");
    expect(voltageRow.values[1]).toBeNull();
  });

  it("compares products that share a category via multicategory overlap", async () => {
    const prisma = getTestPrisma();
    const first = await setupMarketplaceProduct(app, prisma, {
      product: { productName: "Overlap Product A" },
    });
    const second = await setupMarketplaceProduct(app, prisma, {
      product: { productName: "Overlap Product B" },
    });

    const { category: shared } = await createCategoryViaApi(
      app,
      first.adminToken,
      { name: `Shared Compare Cat ${Date.now()}` },
    );

    await productRequest(app, first.sellerToken).update(first.productId, {
      categoryIds: [first.categoryId, shared.id],
    });
    await productRequest(app, second.sellerToken).update(second.productId, {
      categoryIds: [second.categoryId, shared.id],
    });

    const res = await productRequest(app).compare([
      first.productId,
      second.productId,
    ]);

    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(2);
  });

  it("returns 400 when selected products have no common category", async () => {
    const prisma = getTestPrisma();
    const first = await setupMarketplaceProduct(app, prisma, {
      product: { productName: "Disjoint Product A" },
    });
    const second = await setupMarketplaceProduct(app, prisma, {
      product: { productName: "Disjoint Product B" },
      category: { name: `Disjoint Cat ${Date.now()}` },
    });

    const res = await productRequest(app).compare([
      first.productId,
      second.productId,
    ]);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/share at least one category/i);
  });

  it("returns 404 when a product is not marketplace-visible", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const res = await productRequest(app).compare([
      setup.productId,
      "00000000-0000-4000-8000-000000000099",
    ]);
    expect(res.status).toBe(404);
  });

  it("allows comparing an out-of-stock marketplace product", async () => {
    const prisma = getTestPrisma();
    const first = await setupMarketplaceProduct(app, prisma, {
      product: { productName: "In Stock Compare" },
      inventoryQuantity: 5,
    });
    const second = await setupMarketplaceProduct(app, prisma, {
      product: { productName: "Out of Stock Compare" },
      inventoryQuantity: 2,
    });

    await productRequest(app, second.sellerToken).update(second.productId, {
      categoryIds: [first.categoryId],
    });

    await inventoryRequest(app, second.sellerToken).update(
      second.productId,
      { availableQuantity: 0, reason: "Sold out" },
      "compare-oos-1",
    );

    const res = await productRequest(app).compare([
      first.productId,
      second.productId,
    ]);
    expect(res.status).toBe(200);
    expect(res.body.data.productIds).toEqual(
      expect.arrayContaining([first.productId, second.productId]),
    );
  });

  it("returns 400 for invalid productIds count, duplicates, and UUID format", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const onlyOne = await productRequest(app).compare([setup.productId]);
    expect(onlyOne.status).toBe(400);

    const tooManyIds = [
      setup.productId,
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000004",
    ];
    const tooMany = await productRequest(app).compare(tooManyIds);
    expect(tooMany.status).toBe(400);

    const duplicates = await productRequest(app).compare([
      setup.productId,
      setup.productId,
    ]);
    expect(duplicates.status).toBe(400);

    const invalidUuid = await request(app).get(
      "/api/v1/products/compare?productIds=not-a-uuid&productIds=also-bad",
    );
    expect(invalidUuid.status).toBe(400);
  });
});
