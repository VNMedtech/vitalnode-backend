import { randomUUID } from "node:crypto";
import type { Express } from "express";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { ORDER_ACTIONS } from "../../../src/modules/orders/constants/order.constants.js";
import { setupMarketplaceProduct } from "../../factories/commerce.factory.js";
import {
  createDeliveryPartnerDirect,
  ORDER_PROOF_FILE,
  setupOrderTestContext,
} from "../../factories/order.factory.js";
import {
  ensureSystemActorUser,
  type PendingPaymentOrderContext,
} from "../../factories/payment.factory.js";
import { addressCreationPayload } from "../../fixtures/address.payloads.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import {
  createPaymentSignature,
  newIdempotencyKey,
} from "../../utils/payment.helpers.js";
import {
  addressRequest,
  cartRequest,
  orderRequest,
  paymentRequest,
  productRequest,
} from "../../utils/request.helpers.js";

function assertOk(status: number, label: string, body: unknown): void {
  if (status < 200 || status >= 300) {
    throw new Error(
      `${label} failed with status ${status}: ${JSON.stringify(body)}`,
    );
  }
}

export async function getSellerProfileId(
  prisma: PrismaClient,
  userId: string,
): Promise<string> {
  const profile = await prisma.sellerProfile.findFirstOrThrow({
    where: { userId },
    select: { id: true },
  });
  return profile.id;
}

export interface BuyerShoppingContext {
  buyerToken: string;
  buyerUserId: string;
  addressId: string;
}

export async function registerBuyerWithAddress(
  app: Express,
): Promise<BuyerShoppingContext> {
  const { auth } = await registerBuyerViaApi(app);
  const addressRes = await addressRequest(app, auth.accessToken).create(
    addressCreationPayload(),
  );
  assertOk(addressRes.status, "Create address", addressRes.body);

  return {
    buyerToken: auth.accessToken,
    buyerUserId: auth.user.id,
    addressId: addressRes.body.data.id as string,
  };
}

export async function browseMarketplaceProduct(
  app: Express,
  productId: string,
): Promise<void> {
  const listRes = await productRequest(app).listMarketplace();
  assertOk(listRes.status, "List marketplace products", listRes.body);
  expectProductInList(listRes.body.data, productId);

  const detailRes = await productRequest(app).getMarketplaceById(productId);
  assertOk(detailRes.status, "Get marketplace product", detailRes.body);
}

function expectProductInList(
  products: Array<{ id: string }>,
  productId: string,
): void {
  if (!products.some((p) => p.id === productId)) {
    throw new Error(`Product ${productId} not found in marketplace listing`);
  }
}

export function expectProductAbsentFromMarketplace(
  products: Array<{ id: string }>,
  productId: string,
): void {
  if (products.some((p) => p.id === productId)) {
    throw new Error(`Product ${productId} should not appear in marketplace`);
  }
}

export async function checkoutCart(
  app: Express,
  buyerToken: string,
  addressId: string,
  idempotencyKey = newIdempotencyKey("checkout"),
) {
  const res = await orderRequest(app, buyerToken).checkout(
    { shippingAddressId: addressId },
    idempotencyKey,
  );
  assertOk(res.status, "Checkout", res.body);
  return {
    orderId: res.body.data.orderId as string,
    orderNumber: res.body.data.orderNumber as string,
  };
}

export async function verifyPaymentForOrder(
  app: Express,
  buyerToken: string,
  orderId: string,
) {
  const createRes = await paymentRequest(app, buyerToken).createOrder(
    { orderId },
    newIdempotencyKey("create-razorpay-order"),
  );
  assertOk(createRes.status, "Create Razorpay order", createRes.body);

  const razorpayOrderId = createRes.body.data.razorpayOrderId as string;
  const razorpayPaymentId = `pay_e2e_${randomUUID().slice(0, 12)}`;

  const verifyRes = await paymentRequest(app, buyerToken).verify(
    {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature: createPaymentSignature(
        razorpayOrderId,
        razorpayPaymentId,
      ),
    },
    newIdempotencyKey("verify-payment"),
  );

  return { createRes, verifyRes, razorpayOrderId, razorpayPaymentId };
}

export async function fulfillOrderThroughDelivery(
  app: Express,
  context: {
    orderId: string;
    adminToken: string;
    sellerToken: string;
  },
  prisma: PrismaClient,
) {
  const partner = await createDeliveryPartnerDirect(app, prisma);

  const assignRes = await orderRequest(app, context.adminToken).assignDeliveryPartner(
    context.orderId,
    { deliveryPartnerId: partner.deliveryPartnerId },
  );
  assertOk(assignRes.status, "Assign delivery partner", assignRes.body);

  const processRes = await orderRequest(app, context.sellerToken).process(
    context.orderId,
  );
  assertOk(processRes.status, "Process order", processRes.body);

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

  const deliveryProofRes = await orderRequest(
    app,
    partner.deliveryPartnerToken,
  ).uploadDeliveryProof(context.orderId, ORDER_PROOF_FILE);
  assertOk(deliveryProofRes.status, "Upload delivery proof", deliveryProofRes.body);

  const deliveredRes = await orderRequest(
    app,
    partner.deliveryPartnerToken,
  ).markDelivered(context.orderId);
  assertOk(deliveredRes.status, "Mark delivered", deliveredRes.body);

  return partner;
}

export async function setupLowStockMarketplace(
  app: Express,
  prisma: PrismaClient,
  inventoryQuantity: number,
) {
  await ensureSystemActorUser(prisma);
  return setupMarketplaceProduct(app, prisma, { inventoryQuantity });
}

export async function prepareBuyerCart(
  app: Express,
  productId: string,
  quantity: number,
) {
  const buyer = await registerBuyerWithAddress(app);
  const cartRes = await cartRequest(app, buyer.buyerToken).addItem({
    productId,
    quantity,
  });
  assertOk(cartRes.status, "Add to cart", cartRes.body);
  return buyer;
}

export async function buildPendingPaymentContext(
  app: Express,
  prisma: PrismaClient,
): Promise<PendingPaymentOrderContext & { sellerToken: string }> {
  await ensureSystemActorUser(prisma);
  const marketplace = await setupMarketplaceProduct(app, prisma);
  const buyer = await registerBuyerWithAddress(app);

  await browseMarketplaceProduct(app, marketplace.productId);

  await cartRequest(app, buyer.buyerToken).addItem({
    productId: marketplace.productId,
    quantity: 2,
  });

  const checkout = await checkoutCart(
    app,
    buyer.buyerToken,
    buyer.addressId,
  );

  return {
    buyerAuth: { accessToken: buyer.buyerToken, user: { id: buyer.buyerUserId } },
    adminToken: marketplace.adminToken,
    orderId: checkout.orderId,
    orderNumber: checkout.orderNumber,
    productId: marketplace.productId,
    paymentAmountPaise: 0,
    sellerToken: marketplace.sellerToken,
  };
}

export { setupMarketplaceProduct, setupOrderTestContext, ORDER_ACTIONS };
