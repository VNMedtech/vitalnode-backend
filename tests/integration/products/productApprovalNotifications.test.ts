import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as s3Module from "../../../src/infrastructure/s3/index.js";
import { NOTIFICATION_TYPES } from "../../../src/modules/notifications/constants/notification.constants.js";
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

async function waitForNotification(
  prisma: ReturnType<typeof getTestPrisma>,
  userId: string,
  type: string,
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const notification = await prisma.notification.findFirst({
      where: { userId, type },
      orderBy: { createdAt: "desc" },
    });
    if (notification) {
      return notification;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

describe("Products — Approval/Rejection Notifications", () => {
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

  it("creates a PRODUCT_APPROVED in-app notification when admin approves a product", async () => {
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

    const approveRes = await productRequest(
      app,
      adminLogin.auth.accessToken,
    ).approve(productId);

    expect(approveRes.status).toBe(200);

    const notification = await waitForNotification(
      prisma,
      seller.auth.user.id,
      NOTIFICATION_TYPES.PRODUCT_APPROVED,
    );

    expect(notification).toBeTruthy();
    expect(notification?.title).toBe("Product approved");
    expect(notification?.message).toContain(createRes.body.data.productName);
  });

  it("creates a PRODUCT_REJECTED in-app notification when admin rejects a product", async () => {
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

    const rejectRes = await productRequest(
      app,
      adminLogin.auth.accessToken,
    ).reject(productId, { reason: "Incomplete documentation" });

    expect(rejectRes.status).toBe(200);

    const notification = await waitForNotification(
      prisma,
      seller.auth.user.id,
      NOTIFICATION_TYPES.PRODUCT_REJECTED,
    );

    expect(notification).toBeTruthy();
    expect(notification?.title).toBe("Product rejected");
    expect(notification?.message).toContain("Incomplete documentation");
  });

  it("still creates an in-app notification when seller email is unavailable", async () => {
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

    await prisma.user.update({
      where: { id: seller.auth.user.id },
      data: { email: "" },
    });

    const approveRes = await productRequest(
      app,
      adminLogin.auth.accessToken,
    ).approve(productId);

    expect(approveRes.status).toBe(200);

    const notification = await waitForNotification(
      prisma,
      seller.auth.user.id,
      NOTIFICATION_TYPES.PRODUCT_APPROVED,
    );

    expect(notification).toBeTruthy();
    expect(notification?.message).toContain(createRes.body.data.productName);
  });
});
