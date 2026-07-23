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

describe("Products — Admin Catalog Management", () => {
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

  it("lists products across statuses with seller and status filters", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const adminToken = setup.adminToken;

    const secondSeller = await createApprovedSeller(app, prisma);
    const { category } = await createCategoryViaApi(app, adminToken);
    const pendingRes = await productRequest(
      app,
      secondSeller.login.auth.accessToken,
    ).create(productCreationPayload(category.id));
    expect(pendingRes.status).toBe(201);

    const allRes = await productRequest(app, adminToken).listAdmin();
    expect(allRes.status).toBe(200);
    expect(allRes.body.data.length).toBeGreaterThanOrEqual(2);
    expect(allRes.body.meta.total).toBeGreaterThanOrEqual(2);

    const approvedRes = await productRequest(app, adminToken).listAdmin({
      status: "APPROVED",
    });
    expect(approvedRes.status).toBe(200);
    expect(
      approvedRes.body.data.every((p: { status: string }) => p.status === "APPROVED"),
    ).toBe(true);
    expect(
      approvedRes.body.data.some((p: { id: string }) => p.id === setup.productId),
    ).toBe(true);

    const product = await prisma.product.findUnique({
      where: { id: setup.productId },
      select: { sellerId: true },
    });
    expect(product?.sellerId).toBeTruthy();

    const sellerRes = await productRequest(app, adminToken).listAdmin({
      sellerId: product!.sellerId,
    });
    expect(sellerRes.status).toBe(200);
    expect(sellerRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(
      sellerRes.body.data.every(
        (p: { sellerId: string }) => p.sellerId === product!.sellerId,
      ),
    ).toBe(true);

    const pendingFilter = await productRequest(app, adminToken).listAdmin({
      status: "PENDING_APPROVAL",
    });
    expect(pendingFilter.status).toBe(200);
    expect(
      pendingFilter.body.data.some(
        (p: { id: string }) => p.id === pendingRes.body.data.id,
      ),
    ).toBe(true);
  });

  it("returns full admin product detail including media and documents fields", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const res = await productRequest(app, setup.adminToken).getAdminById(
      setup.productId,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(setup.productId);
    expect(res.body.data.status).toBe("APPROVED");
    expect(res.body.data.template.id).toBe(setup.templateId);
    expect(res.body.data.seller).toBeTruthy();
    expect(res.body.data.media).toBeDefined();
    expect(res.body.data.documents).toBeDefined();
    expect(res.body.data.inventory).toBeTruthy();
    expect(res.body.data.attributeFields.length).toBeGreaterThan(0);
  });

  it("admin core edit keeps APPROVED status", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const res = await productRequest(app, setup.adminToken).updateAdmin(
      setup.productId,
      { productName: "Admin Updated Name", description: "Admin updated description" },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.productName).toBe("Admin Updated Name");
    expect(res.body.data.description).toBe("Admin updated description");
    expect(res.body.data.status).toBe("APPROVED");
  });

  it("admin can disable and enable an approved product", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);
    const adminToken = setup.adminToken;

    const disableRes = await productRequest(app, adminToken).disableAdmin(
      setup.productId,
    );
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.data.status).toBe("DISABLED");

    const marketplaceAfterDisable = await productRequest(app).getMarketplaceById(
      setup.productId,
    );
    expect(marketplaceAfterDisable.status).toBe(404);

    const enableRes = await productRequest(app, adminToken).enableAdmin(
      setup.productId,
    );
    expect(enableRes.status).toBe(200);
    expect(enableRes.body.data.status).toBe("APPROVED");

    const marketplaceAfterEnable = await productRequest(app).getMarketplaceById(
      setup.productId,
    );
    expect(marketplaceAfterEnable.status).toBe(200);
  });

  it("rejects admin update of REJECTED products", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const adminToken = adminLogin.auth.accessToken;
    const { category } = await createCategoryViaApi(app, adminToken);
    const seller = await createApprovedSeller(app, prisma);

    const createRes = await productRequest(app, seller.login.auth.accessToken).create(
      productCreationPayload(category.id),
    );
    const productId = createRes.body.data.id;

    await productRequest(app, adminToken).reject(productId, {
      reason: "Incomplete listing",
    });

    const updateRes = await productRequest(app, adminToken).updateAdmin(productId, {
      productName: "Should Fail",
    });
    expect(updateRes.status).toBe(409);
  });

  it("forbids non-admin from admin product endpoints", async () => {
    const prisma = getTestPrisma();
    const setup = await setupMarketplaceProduct(app, prisma);

    const listRes = await productRequest(app, setup.sellerToken).listAdmin();
    expect(listRes.status).toBe(403);

    const detailRes = await productRequest(app, setup.sellerToken).getAdminById(
      setup.productId,
    );
    expect(detailRes.status).toBe(403);
  });
});
