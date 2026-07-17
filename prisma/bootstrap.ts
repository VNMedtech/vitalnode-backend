/**
 * Production database bootstrap — Medical Equipment Marketplace
 *
 * Creates the initial admin user and system actor (for Razorpay webhook audit logs).
 * Safe to re-run: existing admin password is never changed; system actor is upserted.
 *
 * Run: npm run db:bootstrap
 *
 * Required env:
 *   BOOTSTRAP_CONFIRM=true
 *   BOOTSTRAP_ADMIN_EMAIL
 *   BOOTSTRAP_ADMIN_PASSWORD
 *
 * Dev/demo data (categories, sample users, sample orders) — use npm run db:seed instead.
 * Bootstrap intentionally does not create sample orders or shipments.
 */

import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import {
  PrismaClient,
  UserRole,
  UserStatus,
} from "../generated/prisma/client.js";

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);

const DEFAULT_SYSTEM_ACTOR_EMAIL = "system@medical-marketplace.local";

// -----------------------------------------------------------------------------
// Env validation
// -----------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function assertBootstrapAllowed(): void {
  if (process.env.BOOTSTRAP_CONFIRM !== "true") {
    throw new Error(
      "Refusing to run bootstrap without BOOTSTRAP_CONFIRM=true.",
    );
  }
}

function assertAdminPassword(password: string): void {
  if (password.length < 8) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters.");
  }
  if (password.length > 72) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at most 72 characters.");
  }
}

// -----------------------------------------------------------------------------
// Prisma client
// -----------------------------------------------------------------------------

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Cannot run database bootstrap.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, BCRYPT_ROUNDS);
}

// -----------------------------------------------------------------------------
// Bootstrap steps
// -----------------------------------------------------------------------------

async function bootstrapAdmin() {
  const email = requireEnv("BOOTSTRAP_ADMIN_EMAIL");
  const password = requireEnv("BOOTSTRAP_ADMIN_PASSWORD");
  assertAdminPassword(password);

  const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME?.trim() || "Platform";
  const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME?.trim() || "Administrator";
  const phoneNumber = process.env.BOOTSTRAP_ADMIN_PHONE_NUMBER?.trim() || null;

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role !== UserRole.ADMIN) {
      throw new Error(
        `User ${email} already exists with role ${existing.role}; expected ADMIN.`,
      );
    }

    console.log(`Admin already exists: ${email} — skipping (password unchanged)`);
    return existing;
  }

  const passwordHash = await hashPassword(password);

  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      firstName,
      lastName,
      phoneNumber,
      mustChangePassword: false,
    },
  });

  console.log(`Admin user created: ${admin.email}`);
  return admin;
}

async function bootstrapSystemActor() {
  const email =
    process.env.BOOTSTRAP_SYSTEM_ACTOR_EMAIL?.trim() || DEFAULT_SYSTEM_ACTOR_EMAIL;
  const passwordHash = await hashPassword(randomBytes(32).toString("hex"));

  const systemActor = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.DISABLED,
      firstName: "System",
      lastName: "Actor",
      phoneNumber: "+919000000000",
      mustChangePassword: false,
      deletedAt: null,
    },
    create: {
      email,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.DISABLED,
      firstName: "System",
      lastName: "Actor",
      phoneNumber: "+919000000000",
      mustChangePassword: false,
    },
  });

  console.log(`System actor user ready: ${systemActor.email} (${systemActor.id})`);
  return systemActor;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  assertBootstrapAllowed();

  console.log("Starting database bootstrap...");

  await bootstrapAdmin();
  const systemActor = await bootstrapSystemActor();

  console.log("Database bootstrap completed successfully.");
  console.log("");
  console.log("Set in server/.env (required for Razorpay webhooks):");
  console.log(`SYSTEM_ACTOR_USER_ID=${systemActor.id}`);
}

main()
  .catch((error: unknown) => {
    console.error("Database bootstrap failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
