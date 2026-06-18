import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as s3Module from "../../../src/infrastructure/s3/index.js";
import {
  createApprovedSeller,
  registerBuyerViaApi,
} from "../../factories/user.factory.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { uploadRequest } from "../../utils/request.helpers.js";
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

describe("Uploads — File Management", () => {
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

  it("1. uploads a product image as seller", async () => {
    const prisma = getTestPrisma();
    const seller = await createApprovedSeller(app, prisma);

    const res = await uploadRequest(
      app,
      seller.login.auth.accessToken,
    ).uploadImage("PRODUCT_IMAGE", TEST_PNG_BUFFER, "product.png");

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Image uploaded successfully");
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.uploadType).toBe("PRODUCT_IMAGE");
  });

  it("2. uploads a product document as seller", async () => {
    const prisma = getTestPrisma();
    const seller = await createApprovedSeller(app, prisma);

    const res = await uploadRequest(
      app,
      seller.login.auth.accessToken,
    ).uploadDocument("PRODUCT_DOCUMENT", TEST_PDF_BUFFER, "manual.pdf");

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Document uploaded successfully");
    expect(res.body.data.uploadType).toBe("PRODUCT_DOCUMENT");
  });

  it("3. returns file metadata for owner", async () => {
    const prisma = getTestPrisma();
    const seller = await createApprovedSeller(app, prisma);
    const uploadRes = await uploadRequest(
      app,
      seller.login.auth.accessToken,
    ).uploadImage("PRODUCT_IMAGE", TEST_PNG_BUFFER, "product.png");

    const res = await uploadRequest(
      app,
      seller.login.auth.accessToken,
    ).getMetadata(uploadRes.body.data.id);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(uploadRes.body.data.id);
    expect(res.body.data.mimeType).toBe("image/png");
  });

  it("4. generates a signed download URL", async () => {
    const prisma = getTestPrisma();
    const seller = await createApprovedSeller(app, prisma);
    const uploadRes = await uploadRequest(
      app,
      seller.login.auth.accessToken,
    ).uploadImage("PRODUCT_IMAGE", TEST_PNG_BUFFER, "product.png");

    const res = await uploadRequest(
      app,
      seller.login.auth.accessToken,
    ).getSignedUrl(uploadRes.body.data.id);

    expect(res.status).toBe(200);
    expect(res.body.data.signedUrl).toContain("https://");
  });

  it("5. deletes an upload", async () => {
    const prisma = getTestPrisma();
    const seller = await createApprovedSeller(app, prisma);
    const uploadRes = await uploadRequest(
      app,
      seller.login.auth.accessToken,
    ).uploadImage("PRODUCT_IMAGE", TEST_PNG_BUFFER, "product.png");

    const res = await uploadRequest(
      app,
      seller.login.auth.accessToken,
    ).delete(uploadRes.body.data.id);

    expect(res.status).toBe(200);

    const getRes = await uploadRequest(
      app,
      seller.login.auth.accessToken,
    ).getMetadata(uploadRes.body.data.id);
    expect(getRes.status).toBe(404);
  });

  it("6. denies buyer product image upload with 403", async () => {
    const { auth } = await registerBuyerViaApi(app);

    const res = await uploadRequest(app, auth.accessToken).uploadImage(
      "PRODUCT_IMAGE",
      TEST_PNG_BUFFER,
      "product.png",
    );

    expect(res.status).toBe(403);
  });

  it("7. rejects upload without file", async () => {
    const prisma = getTestPrisma();
    const seller = await createApprovedSeller(app, prisma);

    const res = await uploadRequest(
      app,
      seller.login.auth.accessToken,
    ).uploadImage("PRODUCT_IMAGE", Buffer.alloc(0), "empty.png");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });

  it("8. rejects invalid mime type upload", async () => {
    const prisma = getTestPrisma();
    const seller = await createApprovedSeller(app, prisma);
    const fakeImage = Buffer.from("not-a-real-image");

    const res = await uploadRequest(
      app,
      seller.login.auth.accessToken,
    ).uploadImage("PRODUCT_IMAGE", fakeImage, "fake-image.jpg");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });

  it("9. rejects oversized file upload", async () => {
    const prisma = getTestPrisma();
    const seller = await createApprovedSeller(app, prisma);
    const oversized = Buffer.alloc(11 * 1024 * 1024, 0);

    const res = await uploadRequest(
      app,
      seller.login.auth.accessToken,
    ).uploadImage("PRODUCT_IMAGE", oversized, "large.png");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });
});
