import { execSync } from "node:child_process";
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const testsDir = resolve(serverRoot, "tests");

export default function globalSetup(): void {
  config({
    path: resolve(testsDir, ".env.test"),
    override: true,
  });

  process.env.NODE_ENV = "test";

  try {
    execSync("npx prisma migrate deploy", {
      cwd: serverRoot,
      stdio: "inherit",
      env: process.env,
    });
  } catch {
    throw new Error(
      [
        "Failed to apply Prisma migrations to the test database.",
        "Ensure PostgreSQL is running and create the test database:",
        "  createdb medical_test",
        "Or update DATABASE_URL in tests/.env.test",
      ].join("\n"),
    );
  }
}
