import { randomUUID } from "node:crypto";
import type { Express } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { UserRole } from "../../src/shared/enums/userRole.enum.js";
import { UserStatus } from "../../src/shared/enums/userStatus.enum.js";
import { addressCreationPayload } from "../fixtures/address.payloads.js";
import {
  createPaymentSignature,
  newIdempotencyKey,
} from "../utils/payment.helpers.js";
import {
  addressRequest,
  cartRequest,
  orderRequest,
  paymentRequest,
} from "../utils/request.helpers.js";
import { setupMarketplaceProduct } from "./commerce.factory.js";
import {
  createAdminViaApi,
  createUserWithPassword,
  loginViaApi,
  registerBuyerViaApi,
} from "./user.factory.js";

export const TEST_SYSTEM_ACTOR_USER_ID =
  process.env.SYSTEM_ACTOR_USER_ID ?? "00000000-0000-4000-8000-000000000099";

export interface PendingPaymentOrderContext {
  buyerAuth: { accessToken: string; user: { id: string } };
  adminToken: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  paymentAmountPaise: number;
}

export interface PaidPaymentOrderContext extends PendingPaymentOrderContext {
  razorpayOrderId: string;
  razorpayPaymentId: string;
}

function assertOk(status: number, label: string, body: unknown): void {
  if (status < 200 || status >= 300) {
    throw new Error(
      `${label} failed with status ${status}: ${JSON.stringify(body)}`,
    );
  }
}

/**
 * Creates the non-login system actor used by webhook audit entries.
 * Must run after each `resetDatabase()` call.
 */
export async function ensureSystemActorUser(prisma: PrismaClient): Promise<void> {
  await prisma.user.upsert({
    where: { id: TEST_SYSTEM_ACTOR_USER_ID },
    update: {
      status: UserStatus.ACTIVE,
      role: UserRole.ADMIN,
    },
    create: {
      id: TEST_SYSTEM_ACTOR_USER_ID,
      email: "system-actor@test.local",
      passwordHash: "not-used",
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      firstName: "System",
      lastName: "Actor",
    },
  });
}

export async function setupPendingPaymentOrder(
  app: Express,
  prisma: PrismaClient,
): Promise<PendingPaymentOrderContext> {
  await ensureSystemActorUser(prisma);

  const marketplace = await setupMarketplaceProduct(app, prisma);
  const { auth: buyerAuth } = await registerBuyerViaApi(app);

  const addressRes = await addressRequest(app, buyerAuth.accessToken).create(
    addressCreationPayload(),
  );
  assertOk(addressRes.status, "Create address", addressRes.body);
  const addressId = addressRes.body.data.id as string;

  const cartRes = await cartRequest(app, buyerAuth.accessToken).addItem({
    productId: marketplace.productId,
    quantity: 2,
  });
  assertOk(cartRes.status, "Add to cart", cartRes.body);

  const checkoutRes = await orderRequest(app, buyerAuth.accessToken).checkout(
    { shippingAddressId: addressId },
    newIdempotencyKey("checkout"),
  );
  assertOk(checkoutRes.status, "Checkout", checkoutRes.body);

  const payment = await prisma.payment.findUnique({
    where: { orderId: checkoutRes.body.data.orderId as string },
  });
  if (!payment) {
    throw new Error("Payment record missing after checkout");
  }

  return {
    buyerAuth,
    adminToken: marketplace.adminToken,
    orderId: checkoutRes.body.data.orderId as string,
    orderNumber: checkoutRes.body.data.orderNumber as string,
    productId: marketplace.productId,
    paymentAmountPaise: Number(payment.amount) * 100,
  };
}

export async function createRazorpayOrderForContext(
  app: Express,
  context: PendingPaymentOrderContext,
  idempotencyKey = newIdempotencyKey("create-order"),
) {
  return paymentRequest(app, context.buyerAuth.accessToken).createOrder(
    { orderId: context.orderId },
    idempotencyKey,
  );
}

export async function setupPaidPaymentOrder(
  app: Express,
  prisma: PrismaClient,
): Promise<PaidPaymentOrderContext> {
  const pending = await setupPendingPaymentOrder(app, prisma);
  const createRes = await createRazorpayOrderForContext(app, pending);
  assertOk(createRes.status, "Create Razorpay order", createRes.body);

  const razorpayOrderId = createRes.body.data.razorpayOrderId as string;
  const razorpayPaymentId = `pay_mock_${randomUUID().slice(0, 12)}`;
  const razorpaySignature = createPaymentSignature(
    razorpayOrderId,
    razorpayPaymentId,
  );

  const verifyRes = await paymentRequest(
    app,
    pending.buyerAuth.accessToken,
  ).verify(
    {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    },
    newIdempotencyKey("verify"),
  );
  assertOk(verifyRes.status, "Verify payment", verifyRes.body);

  return {
    ...pending,
    razorpayOrderId,
    razorpayPaymentId,
  };
}

export async function setupCancelledPaidOrder(
  app: Express,
  prisma: PrismaClient,
): Promise<PaidPaymentOrderContext> {
  const paid = await setupPaidPaymentOrder(app, prisma);

  const cancelRes = await orderRequest(app, paid.buyerAuth.accessToken).cancel(
    { orderId: paid.orderId, reason: "Changed mind" },
    newIdempotencyKey("cancel"),
  );
  assertOk(cancelRes.status, "Cancel order", cancelRes.body);

  return paid;
}

export async function createAdminActor(app: Express, prisma: PrismaClient) {
  const { login } = await createAdminViaApi(app, prisma);
  return login.auth.accessToken;
}

export async function createNonBuyerUser(prisma: PrismaClient, app: Express) {
  const user = await createUserWithPassword(prisma, {
    email: `non-buyer-${randomUUID().slice(0, 8)}@example.com`,
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  });

  const login = await loginViaApi(app, user.email);
  return { user, token: login.auth.accessToken };
}
