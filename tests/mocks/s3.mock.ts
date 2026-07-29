import { vi } from "vitest";
import * as s3Module from "../../src/infrastructure/s3/index.js";

/**
 * Mocks S3 uploads/downloads used by invoice generation and fulfillment proofs.
 * Call after `vi.restoreAllMocks()` in beforeEach.
 */
export function mockS3Layer(
  overrides: {
    uploadKey?: string;
    bucket?: string;
    signedUrl?: string;
  } = {},
): void {
  const bucket = overrides.bucket ?? "medical-test-bucket";
  const uploadKey = overrides.uploadKey ?? "uploads/mock-object.bin";
  const signedUrl =
    overrides.signedUrl ?? "https://signed.example.com/mock-object";

  vi.spyOn(s3Module, "uploadObjectToS3").mockResolvedValue({
    key: uploadKey,
    bucket,
    etag: "mock-etag",
  });
  vi.spyOn(s3Module, "deleteObjectFromS3").mockResolvedValue(undefined);
  vi.spyOn(s3Module, "generateSignedDownloadUrl").mockResolvedValue(signedUrl);
  vi.spyOn(s3Module, "buildS3ObjectUrl").mockImplementation(
    (key: string) => `https://storage.example.com/${key}`,
  );
}
