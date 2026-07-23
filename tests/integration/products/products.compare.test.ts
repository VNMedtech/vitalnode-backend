import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupMarketplaceProduct } from "../../factories/commerce.factory.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { productRequest } from "../../utils/request.helpers.js";
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

  it("compares marketplace products using core fields and shared attributes", async () => {
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
      category: { name: `Compare Cat ${Date.now()}` },
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

  it("returns 404 when a product is not marketplace-visible", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const res = await productRequest(app).compare([
      setup.productId,
      "00000000-0000-4000-8000-000000000099",
    ]);
    expect(res.status).toBe(404);
  });
});
