import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as s3Module from "../../../src/infrastructure/s3/index.js";
import { productCreationPayload } from "../../fixtures/product.payloads.js";
import { createCategoryViaApi } from "../../factories/commerce.factory.js";
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

describe("E2E — Scenario 08: Marketplace default sort priority", () => {
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

  it("ranks fastest delivery first and lowest price second across marketplace browse", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const seller = await createApprovedSeller(app, prisma);

    const catalog = [
      { productName: "Ultrasound A", deliveryTime: 2, pricing: "10000.00" },
      { productName: "Ultrasound B", deliveryTime: 2, pricing: "9000.00" },
      { productName: "Ultrasound C", deliveryTime: 5, pricing: "7000.00" },
    ];

    const createdIds: string[] = [];

    for (const item of catalog) {
      const createRes = await productRequest(
        app,
        seller.login.auth.accessToken,
      ).create(productCreationPayload(category.id, item));
      const productId = createRes.body.data.id as string;
      await productRequest(app, adminLogin.auth.accessToken).approve(productId);
      createdIds.push(productId);
    }

    const listRes = await productRequest(app).listMarketplace({
      search: "Ultrasound",
    });

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.map((item: { productName: string }) => item.productName)).toEqual([
      "Ultrasound B",
      "Ultrasound A",
      "Ultrasound C",
    ]);
  });
});
