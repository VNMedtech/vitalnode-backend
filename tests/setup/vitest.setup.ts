import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, vi } from "vitest";

const testsDir = dirname(fileURLToPath(import.meta.url));

config({
  path: resolve(testsDir, "../.env.test"),
  override: true,
});

process.env.NODE_ENV = "test";

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});
