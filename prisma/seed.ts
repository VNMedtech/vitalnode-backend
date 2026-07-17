/**
 * Database seed script — Medical Equipment Marketplace
 *
 * Development / demo data only — do not run in production.
 * For production admin + system actor setup, use: npm run db:bootstrap
 *
 * Idempotent: safe to run multiple times. Uses upsert on unique fields
 * (email, category name, profile userId, orderNumber) so existing records
 * are updated rather than duplicated.
 *
 * Also seeds one APPROVED demo product and sample orders at PLACED /
 * CONFIRMED (INTERNAL_DP) / SHIPPED (INTERNAL_DP) for portal smoke tests.
 *
 * Run: npm run db:seed
 */

import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import {
  BuyerType,
  FulfillmentMethod,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  ProductStatus,
  SellerApprovalStatus,
  ShipmentStatus,
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

  const sellerProfile = await prisma.sellerProfile.findUniqueOrThrow({
    where: { userId: sellerUser.id },
  });

  const existingWarehouse = await prisma.sellerAddress.findFirst({
    where: { sellerId: sellerProfile.id, isDefault: true },
  });
  if (!existingWarehouse) {
    await prisma.sellerAddress.create({
      data: {
        sellerId: sellerProfile.id,
        label: "Primary warehouse",
        contactPerson: "Rajesh Mehta",
        addressLine1: "42 Industrial Estate Road",
        addressLine2: "Phase 2, Andheri East",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India",
        postalCode: "400069",
        isDefault: true,
        isActive: true,
      },
    });
  }

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
      nmcRegistrationNumber: "NMC123456",
    },
    create: {
      userId: buyerUser.id,
      buyerType: BuyerType.DOCTOR,
      nmcRegistrationNumber: "NMC123456",
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
// 7. Sample catalog product (for demo orders + marketplace smoke)
// -----------------------------------------------------------------------------

const SEED_PRODUCT_NAME = "VitalNode Seed Pulse Oximeter";

const SEED_SHIPPING_ADDRESS = {
  name: "Dr. Ananya Sharma",
  phone: "+919000000003",
  addressLine1: "12 Clinic Road",
  addressLine2: "Near City Hospital",
  city: "Pune",
  state: "Maharashtra",
  country: "India",
  postalCode: "411001",
};

async function seedSampleProduct(sellerUserId: string) {
  const sellerProfile = await prisma.sellerProfile.findUniqueOrThrow({
    where: { userId: sellerUserId },
  });
  const category = await prisma.category.findFirstOrThrow({
    where: { name: "Patient Monitoring Systems", deletedAt: null },
  });

  const existing = await prisma.product.findFirst({
    where: {
      sellerId: sellerProfile.id,
      productName: SEED_PRODUCT_NAME,
      deletedAt: null,
    },
  });

  if (existing) {
    await prisma.inventory.upsert({
      where: { productId: existing.id },
      update: { availableQuantity: 25 },
      create: { productId: existing.id, availableQuantity: 25 },
    });
    if (existing.status !== ProductStatus.APPROVED) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { status: ProductStatus.APPROVED },
      });
    }
    console.log(`Sample product ready: ${existing.productName}`);
    return existing;
  }

  const product = await prisma.product.create({
    data: {
      sellerId: sellerProfile.id,
      categoryId: category.id,
      productName: SEED_PRODUCT_NAME,
      brand: "VitalNode Demo",
      model: "VN-POX-SEED",
      productType: "Monitoring Device",
      pricing: 8999,
      moq: 1,
      description:
        "Seeded fingertip pulse oximeter for local fulfillment demos (INTERNAL_DP sample orders).",
      status: ProductStatus.APPROVED,
      inventory: { create: { availableQuantity: 25 } },
    },
  });

  console.log(`Sample product seeded: ${product.productName}`);
  return product;
}

// -----------------------------------------------------------------------------
// 8. Sample orders — new commerce statuses + INTERNAL_DP shipments (§15.8)
// -----------------------------------------------------------------------------

async function upsertSeedOrder(params: {
  orderNumber: string;
  orderStatus: OrderStatus;
  buyerProfileId: string;
  sellerProfileId: string;
  deliveryPartnerProfileId: string | null;
  product: { id: string; productName: string; brand: string; model: string; productType: string; pricing: unknown };
  shipment?: {
    status: ShipmentStatus;
    deliveryPartnerId: string;
    shippedAt?: Date | null;
  };
}) {
  const unitPrice = Number(params.product.pricing);
  const quantity = 1;
  const totalPrice = unitPrice * quantity;
  const defaultWarehouse = await prisma.sellerAddress.findFirst({
    where: { sellerId: params.sellerProfileId, isDefault: true },
  });
  const pickupSnapshot = defaultWarehouse
    ? {
        id: defaultWarehouse.id,
        label: defaultWarehouse.label,
        contactPerson: defaultWarehouse.contactPerson,
        phone: defaultWarehouse.phone,
        addressLine1: defaultWarehouse.addressLine1,
        addressLine2: defaultWarehouse.addressLine2,
        city: defaultWarehouse.city,
        state: defaultWarehouse.state,
        country: defaultWarehouse.country,
        postalCode: defaultWarehouse.postalCode,
        latitude: defaultWarehouse.latitude?.toString() ?? null,
        longitude: defaultWarehouse.longitude?.toString() ?? null,
      }
    : undefined;

  const existing = await prisma.order.findUnique({
    where: { orderNumber: params.orderNumber },
    include: { shipment: true, items: true, payment: true },
  });

  if (existing) {
    await prisma.order.update({
      where: { id: existing.id },
      data: {
        orderStatus: params.orderStatus,
        deliveryPartnerId: params.deliveryPartnerProfileId,
        shippingAddressSnapshot: SEED_SHIPPING_ADDRESS,
        placedAt: existing.placedAt ?? new Date(),
        ...(defaultWarehouse
          ? {
              pickupAddressId: defaultWarehouse.id,
              pickupAddressSnapshot: pickupSnapshot,
            }
          : {}),
      },
    });

    if (params.shipment) {
      await prisma.shipment.upsert({
        where: { orderId: existing.id },
        update: {
          method: FulfillmentMethod.INTERNAL_DP,
          status: params.shipment.status,
          deliveryPartnerId: params.shipment.deliveryPartnerId,
          shippedAt: params.shipment.shippedAt ?? null,
        },
        create: {
          orderId: existing.id,
          method: FulfillmentMethod.INTERNAL_DP,
          status: params.shipment.status,
          deliveryPartnerId: params.shipment.deliveryPartnerId,
          shippedAt: params.shipment.shippedAt ?? null,
        },
      });
    }

    console.log(`Sample order ready: ${params.orderNumber} (${params.orderStatus})`);
    return existing;
  }

  const order = await prisma.order.create({
    data: {
      orderNumber: params.orderNumber,
      buyerId: params.buyerProfileId,
      sellerId: params.sellerProfileId,
      deliveryPartnerId: params.deliveryPartnerProfileId,
      shippingAddressSnapshot: SEED_SHIPPING_ADDRESS,
      ...(defaultWarehouse
        ? {
            pickupAddressId: defaultWarehouse.id,
            pickupAddressSnapshot: pickupSnapshot,
          }
        : {}),
      orderStatus: params.orderStatus,
      subtotal: totalPrice,
      totalAmount: totalPrice,
      placedAt: new Date(),
      items: {
        create: {
          productId: params.product.id,
          quantity,
          unitPrice,
          totalPrice,
          productSnapshot: {
            productName: params.product.productName,
            brand: params.product.brand,
            model: params.product.model,
            productType: params.product.productType,
            primaryImageUrl: null,
          },
        },
      },
      payment: {
        create: {
          razorpayOrderId: `seed_rzp_${params.orderNumber}`,
          razorpayPaymentId: `seed_pay_${params.orderNumber}`,
          amount: totalPrice,
          paymentStatus: PaymentStatus.SUCCESS,
        },
      },
      ...(params.shipment
        ? {
            shipment: {
              create: {
                method: FulfillmentMethod.INTERNAL_DP,
                status: params.shipment.status,
                deliveryPartnerId: params.shipment.deliveryPartnerId,
                shippedAt: params.shipment.shippedAt ?? null,
              },
            },
          }
        : {}),
    },
  });

  console.log(`Sample order seeded: ${params.orderNumber} (${params.orderStatus})`);
  return order;
}

async function seedSampleOrders(params: {
  sellerUserId: string;
  buyerUserId: string;
  deliveryPartnerUserId: string;
  product: { id: string; productName: string; brand: string; model: string; productType: string; pricing: unknown };
}) {
  const sellerProfile = await prisma.sellerProfile.findUniqueOrThrow({
    where: { userId: params.sellerUserId },
  });
  const buyerProfile = await prisma.buyerProfile.findUniqueOrThrow({
    where: { userId: params.buyerUserId },
  });
  const deliveryPartnerProfile = await prisma.deliveryPartnerProfile.findUniqueOrThrow({
    where: { userId: params.deliveryPartnerUserId },
  });

  // PLACED — no fulfillment method / shipment yet (D7)
  await upsertSeedOrder({
    orderNumber: "SEED-PLACED-001",
    orderStatus: OrderStatus.PLACED,
    buyerProfileId: buyerProfile.id,
    sellerProfileId: sellerProfile.id,
    deliveryPartnerProfileId: null,
    product: params.product,
  });

  // CONFIRMED + INTERNAL_DP READY — DP active assignment (seller pickup phase)
  await upsertSeedOrder({
    orderNumber: "SEED-CONFIRMED-DP-001",
    orderStatus: OrderStatus.CONFIRMED,
    buyerProfileId: buyerProfile.id,
    sellerProfileId: sellerProfile.id,
    deliveryPartnerProfileId: deliveryPartnerProfile.id,
    product: params.product,
    shipment: {
      status: ShipmentStatus.READY,
      deliveryPartnerId: deliveryPartnerProfile.id,
    },
  });

  // SHIPPED + INTERNAL_DP OUT_FOR_DELIVERY — customer address visible to DP
  await upsertSeedOrder({
    orderNumber: "SEED-SHIPPED-DP-001",
    orderStatus: OrderStatus.SHIPPED,
    buyerProfileId: buyerProfile.id,
    sellerProfileId: sellerProfile.id,
    deliveryPartnerProfileId: deliveryPartnerProfile.id,
    product: params.product,
    shipment: {
      status: ShipmentStatus.OUT_FOR_DELIVERY,
      deliveryPartnerId: deliveryPartnerProfile.id,
      shippedAt: new Date(),
    },
  });
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  console.log("Starting database seed...");

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  await seedAdminUser(passwordHash);
  await seedCategories();
  const seller = await seedSeller(passwordHash);
  const buyer = await seedBuyer(passwordHash);
  const deliveryPartner = await seedDeliveryPartner(passwordHash);
  const systemActor = await seedSystemActorUser();
  const product = await seedSampleProduct(seller.id);
  await seedSampleOrders({
    sellerUserId: seller.id,
    buyerUserId: buyer.id,
    deliveryPartnerUserId: deliveryPartner.id,
    product,
  });

  console.log("Database seed completed successfully.");
  console.log(`Default password for all seeded users: ${DEFAULT_PASSWORD}`);
  console.log("");
  console.log("Sample orders: SEED-PLACED-001, SEED-CONFIRMED-DP-001, SEED-SHIPPED-DP-001");
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
