/**
 * Database seed script — Medical Equipment Marketplace
 *
 * Idempotent: safe to run multiple times. Uses upsert on unique fields
 * (email, category name, profile userId) so existing records are updated
 * rather than duplicated.
 *
 * Run: npx prisma db seed
 */

import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import {
  BuyerType,
  PrismaClient,
  SellerApprovalStatus,
  UserRole,
  UserStatus,
} from "../generated/prisma/client.js";

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/** Default password for all seeded accounts (development only). */
const DEFAULT_PASSWORD = "Password123!";

/** bcrypt cost factor — matches production auth requirements. */
const BCRYPT_ROUNDS = 12;

const SEED_USERS = {
  admin: {
    email: "admin@medical-marketplace.local",
    firstName: "System",
    lastName: "Administrator",
    phoneNumber: "+919000000001",
  },
  seller: {
    email: "seller@medical-marketplace.local",
    firstName: "Rajesh",
    lastName: "Mehta",
    phoneNumber: "+919000000002",
  },
  buyer: {
    email: "doctor@medical-marketplace.local",
    firstName: "Ananya",
    lastName: "Sharma",
    phoneNumber: "+919000000003",
  },
  deliveryPartner: {
    email: "delivery@medical-marketplace.local",
    firstName: "Vikram",
    lastName: "Patel",
    phoneNumber: "+919000000004",
  },
  /** Non-login account for webhook-driven audit logs (SYSTEM_ACTOR_USER_ID). */
  systemActor: {
    email: "system@medical-marketplace.local",
    firstName: "System",
    lastName: "Actor",
    phoneNumber: "+919000000000",
  },
} as const;

/** Realistic medical equipment categories for marketplace browsing and filtering. */
const SEED_CATEGORIES = [
  {
    name: "Diagnostic Imaging",
    description:
      "X-ray machines, CT scanners, MRI systems, and fluoroscopy equipment.",
  },
  {
    name: "Surgical Instruments",
    description:
      "Scalpels, forceps, retractors, and sterile surgical tool sets.",
  },
  {
    name: "Patient Monitoring Systems",
    description:
      "Vital signs monitors, ECG machines, and bedside telemetry devices.",
  },
  {
    name: "Laboratory Equipment",
    description:
      "Centrifuges, microscopes, analyzers, and specimen handling tools.",
  },
  {
    name: "Anesthesia Equipment",
    description:
      "Anesthesia machines, vaporizers, breathing circuits, and monitors.",
  },
  {
    name: "Ventilators & Respiratory Care",
    description:
      "Mechanical ventilators, CPAP/BiPAP devices, and nebulizers.",
  },
  {
    name: "Cardiology Equipment",
    description:
      "Defibrillators, pacemaker programmers, and cardiac stress systems.",
  },
  {
    name: "Orthopedic Implants & Devices",
    description:
      "Joint implants, fixation plates, screws, and external fixation systems.",
  },
  {
    name: "Dental Equipment",
    description:
      "Dental chairs, handpieces, autoclaves, and intraoral imaging systems.",
  },
  {
    name: "Rehabilitation & Physiotherapy",
    description:
      "Treadmills, electrotherapy units, and mobility assistance devices.",
  },
  {
    name: "Ultrasound Systems",
    description:
      "Portable and cart-based ultrasound scanners for diagnostic imaging.",
  },
  {
    name: "Infusion Pumps",
    description:
      "Syringe pumps, volumetric infusion pumps, and IV administration sets.",
  },
] as const;

// -----------------------------------------------------------------------------
// Prisma client (Prisma 7 requires a driver adapter)
// -----------------------------------------------------------------------------

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Cannot run database seed.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// -----------------------------------------------------------------------------
// Seed helpers
// -----------------------------------------------------------------------------

async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, BCRYPT_ROUNDS);
}

// -----------------------------------------------------------------------------
// 1. Default Admin User
//    Role: ADMIN | Status: ACTIVE
//    Platform administrator for approvals, categories, and delivery management.
// -----------------------------------------------------------------------------
async function seedAdminUser(passwordHash: string) {
  const { email, firstName, lastName, phoneNumber } = SEED_USERS.admin;

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      firstName,
      lastName,
      phoneNumber,
      deletedAt: null,
    },
    create: {
      email,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      firstName,
      lastName,
      phoneNumber,
    },
  });

  console.log(`Admin user seeded: ${admin.email}`);
  return admin;
}

// -----------------------------------------------------------------------------
// 2. Sample Categories
//    At least 10 realistic medical equipment categories for product taxonomy.
// -----------------------------------------------------------------------------
async function seedCategories() {
  for (const category of SEED_CATEGORIES) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {
        description: category.description,
        isActive: true,
        deletedAt: null,
      },
      create: {
        name: category.name,
        description: category.description,
        isActive: true,
      },
    });
  }

  console.log(`Categories seeded: ${SEED_CATEGORIES.length}`);
}

// -----------------------------------------------------------------------------
// 3. Sample Seller
//    Approved seller (SellerApprovalStatus.ACTIVE) ready to list products.
// -----------------------------------------------------------------------------
async function seedSeller(passwordHash: string) {
  const { email, firstName, lastName, phoneNumber } = SEED_USERS.seller;

  const sellerUser = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: UserRole.SELLER,
      status: UserStatus.ACTIVE,
      firstName,
      lastName,
      phoneNumber,
      deletedAt: null,
    },
    create: {
      email,
      passwordHash,
      role: UserRole.SELLER,
      status: UserStatus.ACTIVE,
      firstName,
      lastName,
      phoneNumber,
    },
  });

  await prisma.sellerProfile.upsert({
    where: { userId: sellerUser.id },
    update: {
      businessName: "MediTech Instruments Pvt. Ltd.",
      contactPerson: "Rajesh Mehta",
      addressLine1: "42 Industrial Estate Road",
      addressLine2: "Phase 2, Andheri East",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      postalCode: "400069",
      approvalStatus: SellerApprovalStatus.ACTIVE,
    },
    create: {
      userId: sellerUser.id,
      businessName: "MediTech Instruments Pvt. Ltd.",
      contactPerson: "Rajesh Mehta",
      addressLine1: "42 Industrial Estate Road",
      addressLine2: "Phase 2, Andheri East",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      postalCode: "400069",
      approvalStatus: SellerApprovalStatus.ACTIVE,
    },
  });

  console.log(`Approved seller seeded: ${sellerUser.email}`);
  return sellerUser;
}

// -----------------------------------------------------------------------------
// 4. Sample Buyer (Doctor)
//    Doctor account (BuyerType.DOCTOR) for browsing and ordering equipment.
// -----------------------------------------------------------------------------
async function seedBuyer(passwordHash: string) {
  const { email, firstName, lastName, phoneNumber } = SEED_USERS.buyer;

  const buyerUser = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
      firstName,
      lastName,
      phoneNumber,
      deletedAt: null,
    },
    create: {
      email,
      passwordHash,
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
      firstName,
      lastName,
      phoneNumber,
    },
  });

  await prisma.buyerProfile.upsert({
    where: { userId: buyerUser.id },
    update: {
      buyerType: BuyerType.DOCTOR,
    },
    create: {
      userId: buyerUser.id,
      buyerType: BuyerType.DOCTOR,
    },
  });

  console.log(`Doctor buyer seeded: ${buyerUser.email}`);
  return buyerUser;
}

// -----------------------------------------------------------------------------
// 5. Sample Delivery Partner
//    Active delivery partner (UserStatus.ACTIVE) for order fulfillment.
// -----------------------------------------------------------------------------
async function seedDeliveryPartner(passwordHash: string) {
  const { email, firstName, lastName, phoneNumber } = SEED_USERS.deliveryPartner;

  const deliveryUser = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: UserRole.DELIVERY_PARTNER,
      status: UserStatus.ACTIVE,
      firstName,
      lastName,
      phoneNumber,
      deletedAt: null,
    },
    create: {
      email,
      passwordHash,
      role: UserRole.DELIVERY_PARTNER,
      status: UserStatus.ACTIVE,
      firstName,
      lastName,
      phoneNumber,
    },
  });

  await prisma.deliveryPartnerProfile.upsert({
    where: { userId: deliveryUser.id },
    update: {
      addressLine1: "15 Logistics Park Avenue",
      addressLine2: "Warehouse Block C",
      city: "Pune",
      state: "Maharashtra",
      country: "India",
      postalCode: "411014",
    },
    create: {
      userId: deliveryUser.id,
      addressLine1: "15 Logistics Park Avenue",
      addressLine2: "Warehouse Block C",
      city: "Pune",
      state: "Maharashtra",
      country: "India",
      postalCode: "411014",
    },
  });

  console.log(`Delivery partner seeded: ${deliveryUser.email}`);
  return deliveryUser;
}

// -----------------------------------------------------------------------------
// 6. System Actor User
//    Disabled ADMIN used as actorUserId for Razorpay webhook audit entries.
//    Set SYSTEM_ACTOR_USER_ID in .env to this user's id.
// -----------------------------------------------------------------------------
async function seedSystemActorUser() {
  const { email, firstName, lastName, phoneNumber } = SEED_USERS.systemActor;
  const passwordHash = await hashPassword(randomBytes(32).toString("hex"));

  const systemActor = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.DISABLED,
      firstName,
      lastName,
      phoneNumber,
      mustChangePassword: false,
      deletedAt: null,
    },
    create: {
      email,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.DISABLED,
      firstName,
      lastName,
      phoneNumber,
      mustChangePassword: false,
    },
  });

  console.log(`System actor user seeded: ${systemActor.email} (${systemActor.id})`);
  return systemActor;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  console.log("Starting database seed...");

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  await seedAdminUser(passwordHash);
  await seedCategories();
  await seedSeller(passwordHash);
  await seedBuyer(passwordHash);
  await seedDeliveryPartner(passwordHash);
  const systemActor = await seedSystemActorUser();

  console.log("Database seed completed successfully.");
  console.log(`Default password for all seeded users: ${DEFAULT_PASSWORD}`);
  console.log("");
  console.log("Add to server/.env (required for Razorpay webhooks):");
  console.log(`SYSTEM_ACTOR_USER_ID=${systemActor.id}`);
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
