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
  registerSellerViaApi,
} from "../../factories/user.factory.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { productRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Products — Catalog & Approval Workflow", () => {
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

  it("1. allows approved seller to create a pending product", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const seller = await createApprovedSeller(app, prisma);
    const payload = productCreationPayload(category.id);

    const res = await productRequest(app, seller.login.auth.accessToken).create(
      payload,
    );

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING_APPROVAL");
    expect(res.body.data.productName).toBe(payload.productName);
  });

  it("2. lists seller own products", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const seller = await createApprovedSeller(app, prisma);
    const payload = productCreationPayload(category.id);
    await productRequest(app, seller.login.auth.accessToken).create(payload);

    const res = await productRequest(app, seller.login.auth.accessToken).listOwn();

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].productName).toBe(payload.productName);
  });

  it("3. lists pending products for admin", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const seller = await createApprovedSeller(app, prisma);
    await productRequest(app, seller.login.auth.accessToken).create(
      productCreationPayload(category.id),
    );

    const res = await productRequest(app, adminLogin.auth.accessToken).listPending();

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe("PENDING_APPROVAL");
  });

  it("4. approves a pending product", async () => {
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
    const productId = createRes.body.data.id;

    const res = await productRequest(app, adminLogin.auth.accessToken).approve(
      productId,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("APPROVED");
  });

  it("5. rejects a pending product with reason", async () => {
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

    const res = await productRequest(app, adminLogin.auth.accessToken).reject(
      createRes.body.data.id,
      { reason: "Incomplete documentation" },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("REJECTED");
  });

  it("6. exposes approved products on marketplace listing", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const res = await productRequest(app).listMarketplace();

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(setup.productId);
    expect(res.body.data[0].status).toBe("APPROVED");
  });

  it("7. returns marketplace product details by id", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const res = await productRequest(app).getMarketplaceById(setup.productId);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(setup.productId);
    expect(res.body.data.inventory).toBeTruthy();
  });

  it("8. allows seller to update own product", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const res = await productRequest(app, setup.sellerToken).update(
      setup.productId,
      { productName: "Updated Product Name" },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.productName).toBe("Updated Product Name");
  });

  it("9. allows seller to disable an approved product", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const res = await productRequest(app, setup.sellerToken).disable(
      setup.productId,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("DISABLED");
  });

  it("10. hides pending products from marketplace", async () => {
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

    const listRes = await productRequest(app).listMarketplace();
    expect(listRes.body.data).toHaveLength(0);

    const detailRes = await productRequest(app).getMarketplaceById(
      createRes.body.data.id,
    );
    expect(detailRes.status).toBe(404);
  });

  it("11. denies buyer product creation with 403", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const { auth } = await registerBuyerViaApi(app);

    const res = await productRequest(app, auth.accessToken).create(
      productCreationPayload(category.id),
    );

    expect(res.status).toBe(403);
  });

  it("12. denies unapproved seller product creation with 403", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const { auth } = await registerSellerViaApi(app);

    const res = await productRequest(app, auth.accessToken).create(
      productCreationPayload(category.id),
    );

    expect(res.status).toBe(403);
  });
});
