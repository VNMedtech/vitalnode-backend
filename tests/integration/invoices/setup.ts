/**
 * Shared integration test lifecycle for the Invoices module.
 */
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, vi } from "vitest";
import * as s3Module from "../../../src/infrastructure/s3/index.js";
import { mockRazorpayLayer } from "../../mocks/razorpay.mock.js";
import { disconnectTestPrisma, resetDatabase } from "../../utils/db.js";
import { getTestApp } from "../../utils/testApp.js";

function mockS3Layer(): void {
  vi.spyOn(s3Module, "uploadObjectToS3").mockResolvedValue({
    key: "invoices/VN-INV-20260625-000001.pdf",
    bucket: "medical-test-bucket",
    etag: "mock-etag",
  });
  vi.spyOn(s3Module, "deleteObjectFromS3").mockResolvedValue(undefined);
  vi.spyOn(s3Module, "generateSignedDownloadUrl").mockResolvedValue(
    "https://signed.example.com/invoices/mock-invoice.pdf",
  );
  vi.spyOn(s3Module, "buildS3ObjectUrl").mockImplementation(
    (key: string) => `https://storage.example.com/${key}`,
  );
}

export function useInvoicesTestLifecycle(): { getApp: () => Express } {
  let app: Express;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetDatabase();
    mockRazorpayLayer();
    mockS3Layer();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  return {
    getApp: () => app,
  };
}
