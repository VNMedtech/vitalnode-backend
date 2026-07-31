import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as s3Module from "../../../src/infrastructure/s3/index.js";
import { productCreationPayload } from "../../fixtures/product.payloads.js";
import {
  createCategoryViaApi,
  createTemplateViaApi,
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
import { inventoryRequest, productRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";
import { TEST_PDF_BUFFER, TEST_PNG_BUFFER } from "../../utils/upload.helpers.js";

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

describe("Products — Catalog & Approval Workflow", () => {
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

  it("1. allows approved seller to create a pending product with categories", async () => {
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
    expect(res.body.data.categories).toHaveLength(1);
    expect(res.body.data.categories[0].id).toBe(category.id);
    expect(res.body.data.templateId).toBeNull();
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

  it("3b. returns full pending product details for admin", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const seller = await createApprovedSeller(app, prisma);
    const payload = productCreationPayload(category.id);
    const createRes = await productRequest(
      app,
      seller.login.auth.accessToken,
    ).createMultipart(
      {
        categoryIds: JSON.stringify(payload.categoryIds),
        productName: payload.productName,
        brand: payload.brand,
        model: payload.model,
        pricing: payload.pricing,
        moq: String(payload.moq),
        description: payload.description,
        documentTypes: JSON.stringify(["manual"]),
      },
      {
        images: [{ buffer: TEST_PNG_BUFFER, filename: "product.png" }],
        documents: [{ buffer: TEST_PDF_BUFFER, filename: "manual.pdf" }],
      },
    );
    const productId = createRes.body.data.id;

    const res = await productRequest(
      app,
      adminLogin.auth.accessToken,
    ).getPendingById(productId);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(productId);
    expect(res.body.data.status).toBe("PENDING_APPROVAL");
    expect(res.body.data.description).toBe(payload.description);
    expect(res.body.data.media.length).toBeGreaterThan(0);
    expect(res.body.data.documents.length).toBeGreaterThan(0);

    const marketplaceRes = await productRequest(app).getMarketplaceById(productId);
    expect(marketplaceRes.status).toBe(404);
  });

  it("4. rejects approve without template and succeeds after attach", async () => {
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
    const createRes = await productRequest(
      app,
      seller.login.auth.accessToken,
    ).create(productCreationPayload(category.id));
    const productId = createRes.body.data.id;

    const rejectApprove = await productRequest(
      app,
      adminLogin.auth.accessToken,
    ).approve(productId);
    expect(rejectApprove.status).toBe(400);
    expect(rejectApprove.body.message).toMatch(/template/i);

    const attachRes = await productRequest(
      app,
      adminLogin.auth.accessToken,
    ).attachTemplate(productId, { templateId: template.id });
    expect(attachRes.status).toBe(200);
    expect(attachRes.body.data.templateId).toBe(template.id);
    expect(attachRes.body.data.attributes).toMatchObject({
      color: "White",
      weight: 1.5,
      deliveryTime: 7,
    });

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

  it("6. exposes approved products on marketplace listing filtered by category", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const res = await productRequest(app).listMarketplace({
      categoryId: setup.categoryId,
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(setup.productId);
    expect(res.body.data[0].status).toBe("APPROVED");
    expect(res.body.data[0].categories[0].id).toBe(setup.categoryId);
    expect(res.body.data[0].inventory).toEqual(
      expect.objectContaining({
        availableQuantity: expect.any(Number),
      }),
    );
  });

  it("6b. keeps out-of-stock products on marketplace list and detail", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma, {
      inventoryQuantity: 3,
    });

    await inventoryRequest(app, setup.sellerToken).update(
      setup.productId,
      { availableQuantity: 0, reason: "Sold out" },
      "products-oos-marketplace-1",
    );

    const listRes = await productRequest(app).listMarketplace({
      categoryId: setup.categoryId,
    });
    expect(listRes.status).toBe(200);
    const listed = listRes.body.data.find(
      (p: { id: string }) => p.id === setup.productId,
    );
    expect(listed).toMatchObject({
      status: "OUT_OF_STOCK",
      inventory: { availableQuantity: 0 },
    });

    const detailRes = await productRequest(app).getMarketplaceById(
      setup.productId,
    );
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.status).toBe("OUT_OF_STOCK");
    expect(detailRes.body.data.inventory.availableQuantity).toBe(0);
  });

  it("7. returns marketplace product details by id with attribute fields", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const res = await productRequest(app).getMarketplaceById(setup.productId);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(setup.productId);
    expect(res.body.data.inventory).toBeTruthy();
    expect(res.body.data.template.id).toBe(setup.templateId);
    expect(res.body.data.attributeFields.length).toBeGreaterThan(0);
  });

  it("8. attributes-only update keeps APPROVED; core change forces re-approval", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const attrsRes = await productRequest(app, setup.sellerToken).update(
      setup.productId,
      { attributes: { color: "Black", customNote: "orphan kept" } },
    );
    expect(attrsRes.status).toBe(200);
    expect(attrsRes.body.data.status).toBe("APPROVED");
    expect(attrsRes.body.data.attributes.color).toBe("Black");
    expect(attrsRes.body.data.attributes.customNote).toBe("orphan kept");

    const coreRes = await productRequest(app, setup.sellerToken).update(
      setup.productId,
      { productName: "Updated Product Name" },
    );
    expect(coreRes.status).toBe(200);
    expect(coreRes.body.data.productName).toBe("Updated Product Name");
    expect(coreRes.body.data.status).toBe("PENDING_APPROVAL");
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

  it("13. creates a product with multipart image and document uploads", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const seller = await createApprovedSeller(app, prisma);
    const payload = productCreationPayload(category.id);

    const res = await productRequest(
      app,
      seller.login.auth.accessToken,
    ).createMultipart(
      {
        categoryIds: JSON.stringify(payload.categoryIds),
        productName: payload.productName,
        brand: payload.brand,
        model: payload.model,
        pricing: payload.pricing,
        moq: String(payload.moq),
        description: payload.description,
        documentTypes: JSON.stringify(["manual"]),
      },
      {
        images: [{ buffer: TEST_PNG_BUFFER, filename: "product.png" }],
        documents: [{ buffer: TEST_PDF_BUFFER, filename: "manual.pdf" }],
      },
    );

    expect(res.status).toBe(201);
    expect(res.body.data.media).toHaveLength(1);
    expect(res.body.data.media[0].fileUploadId).toBeTruthy();
    expect(res.body.data.documents).toHaveLength(1);
    expect(res.body.data.documents[0].fileUploadId).toBeTruthy();
  });

  it("14. rejects product document upload without documentTypes", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const seller = await createApprovedSeller(app, prisma);
    const payload = productCreationPayload(category.id);

    const res = await productRequest(
      app,
      seller.login.auth.accessToken,
    ).createMultipart(
      {
        categoryIds: JSON.stringify(payload.categoryIds),
        productName: payload.productName,
        brand: payload.brand,
        model: payload.model,
        pricing: payload.pricing,
        moq: String(payload.moq),
        description: payload.description,
      },
      {
        documents: [{ buffer: TEST_PDF_BUFFER, filename: "manual.pdf" }],
      },
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });
});
