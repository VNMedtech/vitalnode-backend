import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupMarketplaceProduct } from "../../factories/commerce.factory.js";
import {
  createAdminViaApi,
  createApprovedSeller,
} from "../../factories/user.factory.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { inventoryRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Inventory — Stock Management", () => {
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

  it("1. returns inventory for seller-owned product", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma, {
      inventoryQuantity: 25,
    });

    const res = await inventoryRequest(app, setup.sellerToken).get(
      setup.productId,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.availableQuantity).toBe(25);
    expect(res.body.data.inventoryStatus).toBe("IN_STOCK");
  });

  it("2. updates inventory quantity", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const res = await inventoryRequest(app, setup.sellerToken).update(
      setup.productId,
      { availableQuantity: 100, reason: "Warehouse restock" },
      "update-stock-1",
    );

    expect(res.status).toBe(200);
    expect(res.body.data.availableQuantity).toBe(100);
  });

  it("3. records inventory movement history", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma, {
      inventoryQuantity: 10,
    });

    await inventoryRequest(app, setup.sellerToken).update(
      setup.productId,
      { availableQuantity: 30, reason: "Restock batch A" },
      "movement-test-1",
    );

    const res = await inventoryRequest(app, setup.sellerToken).listMovements(
      setup.productId,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data[0].movementType).toBeTruthy();
  });

  it("4. lists low stock alerts for admin", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma, {
      inventoryQuantity: 1,
      product: { moq: 5 },
    });
    const { login: adminLogin } = await createAdminViaApi(app, prisma);

    const res = await inventoryRequest(
      app,
      adminLogin.auth.accessToken,
    ).listLowStockAlerts({ alertStatus: "LOW_STOCK" });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].productId).toBe(setup.productId);
    expect(res.body.data[0].inventoryStatus).toBe("LOW_STOCK");
  });

  it("4b. lists low stock alerts for seller (scoped to own products)", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma, {
      inventoryQuantity: 1,
      product: { moq: 5 },
    });

    const res = await inventoryRequest(app, setup.sellerToken).listLowStockAlerts(
      { alertStatus: "LOW_STOCK" },
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].productId).toBe(setup.productId);
    expect(res.body.data[0].inventoryStatus).toBe("LOW_STOCK");
  });

  it("5. requires idempotency key for inventory updates", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const res = await inventoryRequest(app, setup.sellerToken).update(
      setup.productId,
      { availableQuantity: 20 },
      "",
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Idempotency-Key header is required");
  });

  it("6. allows admin to access any product inventory", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const { login: adminLogin } = await createAdminViaApi(app, prisma);

    const res = await inventoryRequest(
      app,
      adminLogin.auth.accessToken,
    ).get(setup.productId);

    expect(res.status).toBe(200);
    expect(res.body.data.productId).toBe(setup.productId);
  });

  it("7. denies seller access to another seller inventory", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const otherSeller = await createApprovedSeller(app, prisma);

    const res = await inventoryRequest(
      app,
      otherSeller.login.auth.accessToken,
    ).get(setup.productId);

    expect(res.status).toBe(403);
  });

  it("8. syncs product OUT_OF_STOCK when quantity is zero", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma, {
      inventoryQuantity: 10,
    });

    await inventoryRequest(app, setup.sellerToken).update(
      setup.productId,
      { availableQuantity: 0, reason: "Sold out" },
      "zero-stock-1",
    );

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: setup.productId },
    });

    expect(product.status).toBe("OUT_OF_STOCK");
  });
});
