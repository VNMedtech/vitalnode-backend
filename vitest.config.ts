import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    globalSetup: ["./tests/setup/globalSetup.ts"],
    fileParallelism: false,
    pool: "forks",
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    reporters: process.env.CI ? ["verbose"] : ["default"],
  },
});
