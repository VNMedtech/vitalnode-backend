import type { Express } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { deliveryPartnerCreationPayload } from "../fixtures/order.payloads.js";
import { TEST_PNG_BUFFER } from "../utils/upload.helpers.js";
import { newIdempotencyKey } from "../utils/payment.helpers.js";
import {
  deliveryPartnerRequest,
  orderRequest,
} from "../utils/request.helpers.js";
import {
  type PaidPaymentOrderContext,
  setupPaidPaymentOrder,
} from "./payment.factory.js";
import {
  createDeliveryPartnerUser,
  loginDeliveryPartnerViaApi,
  loginViaApi,
} from "./user.factory.js";

function assertOk(status: number, label: string, body: unknown): void {
  if (status < 200 || status >= 300) {
    throw new Error(
      `${label} failed with status ${status}: ${JSON.stringify(body)}`,
    );
  }
}

export interface OrderTestContext extends PaidPaymentOrderContext {
  sellerToken: string;
  sellerUserId: string;
}

export interface DeliveryPartnerContext {
  deliveryPartnerId: string;
  deliveryPartnerUserId: string;
  deliveryPartnerToken: string;
}

export interface AssignedOrderContext extends OrderTestContext {
  deliveryPartner: DeliveryPartnerContext;
}

export interface ProcessingOrderContext extends AssignedOrderContext {}

export interface OutForDeliveryOrderContext extends AssignedOrderContext {}

export interface DeliveredOrderContext extends AssignedOrderContext {}

export const ORDER_PROOF_FILE = {
  buffer: TEST_PNG_BUFFER,
  filename: "proof.png",
} as const;

export async function enrichPaidOrderContext(
  app: Express,
  prisma: PrismaClient,
  paid: PaidPaymentOrderContext,
): Promise<OrderTestContext> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: paid.orderId },
    select: {
      seller: {
        select: {
          user: { select: { id: true, email: true } },
        },
      },
    },
  });

  const sellerLogin = await loginViaApi(app, order.seller.user.email);

  return {
    ...paid,
    sellerToken: sellerLogin.auth.accessToken,
    sellerUserId: order.seller.user.id,
  };
}

export async function setupOrderTestContext(
  app: Express,
  prisma: PrismaClient,
): Promise<OrderTestContext> {
  const paid = await setupPaidPaymentOrder(app, prisma);
  return enrichPaidOrderContext(app, prisma, paid);
}

export async function createDeliveryPartnerViaApi(
  app: Express,
  adminToken: string,
  overrides: Record<string, unknown> = {},
): Promise<DeliveryPartnerContext> {
  const payload = deliveryPartnerCreationPayload(overrides);
  const createRes = await deliveryPartnerRequest(app, adminToken).create(payload);
  assertOk(createRes.status, "Create delivery partner", createRes.body);

  const deliveryPartnerId = createRes.body.data.deliveryPartner.id as string;
  const deliveryPartnerUserId = createRes.body.data.deliveryPartner.user
    .id as string;
  const temporaryPassword = createRes.body.data.temporaryPassword as string;

  const loginRes = await loginViaApi(app, payload.email, temporaryPassword);
  assertOk(loginRes.response.status, "Login delivery partner", loginRes.response.body);

  return {
    deliveryPartnerId,
    deliveryPartnerUserId,
    deliveryPartnerToken: loginRes.auth.accessToken,
  };
}

export async function createDeliveryPartnerDirect(
  app: Express,
  prisma: PrismaClient,
): Promise<DeliveryPartnerContext> {
  const user = await createDeliveryPartnerUser(prisma, {
    mustChangePassword: false,
  });
  const login = await loginDeliveryPartnerViaApi(app, user.email);

  return {
    deliveryPartnerId: user.deliveryPartnerProfile!.id,
    deliveryPartnerUserId: user.id,
    deliveryPartnerToken: login.auth.accessToken,
  };
}

export async function assignDeliveryPartnerToOrder(
  app: Express,
  adminToken: string,
  orderId: string,
  deliveryPartnerId: string,
): Promise<void> {
  const res = await orderRequest(app, adminToken).assignDeliveryPartner(orderId, {
    deliveryPartnerId,
  });
  assertOk(res.status, "Assign delivery partner", res.body);
}

export async function setupAssignedOrder(
  app: Express,
  prisma: PrismaClient,
): Promise<AssignedOrderContext> {
  const context = await setupOrderTestContext(app, prisma);
  const deliveryPartner = await createDeliveryPartnerDirect(app, prisma);

  await assignDeliveryPartnerToOrder(
    app,
    context.adminToken,
    context.orderId,
    deliveryPartner.deliveryPartnerId,
  );

  return { ...context, deliveryPartner };
}

export async function setupProcessingOrder(
  app: Express,
  prisma: PrismaClient,
): Promise<ProcessingOrderContext> {
  const context = await setupAssignedOrder(app, prisma);

  const processRes = await orderRequest(app, context.sellerToken).process(
    context.orderId,
  );
  assertOk(processRes.status, "Process order", processRes.body);

  return context;
}

export async function setupOutForDeliveryOrder(
  app: Express,
  prisma: PrismaClient,
): Promise<OutForDeliveryOrderContext> {
  const context = await setupProcessingOrder(app, prisma);

  const handoverRes = await orderRequest(
    app,
    context.sellerToken,
  ).uploadHandoverProof(context.orderId, ORDER_PROOF_FILE);
  assertOk(handoverRes.status, "Upload handover proof", handoverRes.body);

  const outRes = await orderRequest(
    app,
    context.sellerToken,
  ).markOutForDelivery(context.orderId);
  assertOk(outRes.status, "Mark out for delivery", outRes.body);

  return context;
}

export async function setupDeliveredOrder(
  app: Express,
  prisma: PrismaClient,
): Promise<DeliveredOrderContext> {
  const context = await setupOutForDeliveryOrder(app, prisma);

  const proofRes = await orderRequest(
    app,
    context.deliveryPartner.deliveryPartnerToken,
  ).uploadDeliveryProof(context.orderId, ORDER_PROOF_FILE);
  assertOk(proofRes.status, "Upload delivery proof", proofRes.body);

  const deliveredRes = await orderRequest(
    app,
    context.deliveryPartner.deliveryPartnerToken,
  ).markDelivered(context.orderId);
  assertOk(deliveredRes.status, "Mark delivered", deliveredRes.body);

  return context;
}

export async function cancelOrderAsBuyer(
  app: Express,
  buyerToken: string,
  orderId: string,
  reason = "Test cancel",
): Promise<void> {
  const res = await orderRequest(app, buyerToken).cancel(
    { orderId, reason },
    newIdempotencyKey("cancel"),
  );
  assertOk(res.status, "Cancel order", res.body);
}
