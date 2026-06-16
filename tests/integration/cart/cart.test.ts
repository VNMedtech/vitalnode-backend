import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { productCreationPayload } from "../../fixtures/product.payloads.js";
import {
  createCategoryViaApi,
  setupMarketplaceProduct,
} from "../../factories/commerce.factory.js";
import {
  createAdminViaApi,
  createApprovedSeller,
  registerBuyerViaApi,
} from "../../factories/user.factory.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import {
  cartRequest,
  inventoryRequest,
  productRequest,
} from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Cart — Buyer Shopping Cart", () => {
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

  it("1. returns empty cart for new buyer", async () => {
    const { auth } = await registerBuyerViaApi(app);

    const res = await cartRequest(app, auth.accessToken).get();

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.itemCount).toBe(0);
    expect(res.body.data.subtotal).toBe("0");
  });

  it("2. adds an item to cart", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const { auth } = await registerBuyerViaApi(app);

    const res = await cartRequest(app, auth.accessToken).addItem({
      productId: setup.productId,
      quantity: 2,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(2);
    expect(res.body.data.itemCount).toBe(1);
    expect(res.body.data.totalItems).toBe(2);
  });

  it("3. combines quantity when adding same product again", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const { auth } = await registerBuyerViaApi(app);

    await cartRequest(app, auth.accessToken).addItem({
      productId: setup.productId,
      quantity: 2,
    });
    const res = await cartRequest(app, auth.accessToken).addItem({
      productId: setup.productId,
      quantity: 3,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(5);
  });

  it("4. updates cart item quantity", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const { auth } = await registerBuyerViaApi(app);

    const addRes = await cartRequest(app, auth.accessToken).addItem({
      productId: setup.productId,
      quantity: 2,
    });
    const itemId = addRes.body.data.items[0].id;

    const res = await cartRequest(app, auth.accessToken).updateItem(itemId, {
      quantity: 4,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].quantity).toBe(4);
  });

  it("5. removes a cart item", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const { auth } = await registerBuyerViaApi(app);

    const addRes = await cartRequest(app, auth.accessToken).addItem({
      productId: setup.productId,
      quantity: 1,
    });
    const itemId = addRes.body.data.items[0].id;

    const res = await cartRequest(app, auth.accessToken).removeItem(itemId);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it("6. clears the entire cart", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const { auth } = await registerBuyerViaApi(app);

    await cartRequest(app, auth.accessToken).addItem({
      productId: setup.productId,
      quantity: 2,
    });

    const res = await cartRequest(app, auth.accessToken).clear();

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it("7. rejects quantity exceeding inventory with 409", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma, {
      inventoryQuantity: 5,
    });
    const { auth } = await registerBuyerViaApi(app);

    const res = await cartRequest(app, auth.accessToken).addItem({
      productId: setup.productId,
      quantity: 10,
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("8. enforces single-seller cart rule", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const sellerA = await createApprovedSeller(app, prisma, {
      businessName: "Seller Alpha",
    });
    const sellerB = await createApprovedSeller(app, prisma, {
      businessName: "Seller Beta",
    });

    const productA = await productRequest(
      app,
      sellerA.login.auth.accessToken,
    ).create(productCreationPayload(category.id));
    const productB = await productRequest(
      app,
      sellerB.login.auth.accessToken,
    ).create(productCreationPayload(category.id));

    const productAId = productA.body.data.id;
    const productBId = productB.body.data.id;

    await productRequest(app, adminLogin.auth.accessToken).approve(productAId);
    await productRequest(app, adminLogin.auth.accessToken).approve(productBId);

    await inventoryRequest(app, sellerA.login.auth.accessToken).update(
      productAId,
      { availableQuantity: 10 },
      `stock-a-${productAId}`,
    );
    await inventoryRequest(app, sellerB.login.auth.accessToken).update(
      productBId,
      { availableQuantity: 10 },
      `stock-b-${productBId}`,
    );

    const { auth } = await registerBuyerViaApi(app);
    await cartRequest(app, auth.accessToken).addItem({
      productId: productAId,
      quantity: 1,
    });

    const res = await cartRequest(app, auth.accessToken).addItem({
      productId: productBId,
      quantity: 1,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });

  it("9. rejects unapproved products", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const seller = await createApprovedSeller(app, prisma);
    const createRes = await productRequest(
      app,
      seller.login.auth.accessToken,
    ).create(productCreationPayload(category.id));
    const { auth } = await registerBuyerViaApi(app);

    const res = await cartRequest(app, auth.accessToken).addItem({
      productId: createRes.body.data.id,
      quantity: 1,
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Product not found or unavailable");
  });

  it("10. denies seller cart access with 403", async () => {
    const prisma = getTestPrisma();
    const seller = await createApprovedSeller(app, prisma);

    const res = await cartRequest(app, seller.login.auth.accessToken).get();

    expect(res.status).toBe(403);
  });
});
