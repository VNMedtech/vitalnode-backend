import { describe, expect, it } from "vitest";
import {
  createRazorpayOrderForContext,
  setupPendingPaymentOrder,
} from "../../factories/payment.factory.js";
import { addressCreationPayload } from "../../fixtures/address.payloads.js";
import { getTestPrisma } from "../../utils/db.js";
import {
  createPaymentSignature,
  newIdempotencyKey,
} from "../../utils/payment.helpers.js";
import { randomRazorpayPaymentId } from "../../fixtures/payment.payloads.js";
import {
  addressRequest,
  cartRequest,
  orderRequest,
  paymentRequest,
} from "../../utils/request.helpers.js";
import { setupMarketplaceProduct } from "../../factories/commerce.factory.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { useOrdersTestLifecycle } from "./setup.js";

describe("Orders — Section 1: Order Creation", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("creates an order successfully from cart checkout", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
      include: { items: true, payment: true },
    });

    expect(order).not.toBeNull();
    expect(order?.orderStatus).toBe("PENDING_PAYMENT");
    expect(order?.orderNumber).toBe(context.orderNumber);
    expect(order?.items).toHaveLength(1);
    expect(order?.payment?.paymentStatus).toBe("PENDING");
  });

  it("persists product snapshots on order items at checkout", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: context.productId },
    });
    const orderItem = await prisma.orderItem.findFirst({
      where: { orderId: context.orderId },
    });

    expect(orderItem).not.toBeNull();
    const snapshot = orderItem!.productSnapshot as Record<string, unknown>;
    expect(snapshot.id).toBe(context.productId);
    expect(snapshot.productName).toBe(product.productName);
    expect(snapshot.brand).toBe(product.brand);
    expect(snapshot.pricing).toBe(product.pricing.toString());
  });

  it("persists shipping address snapshot on the order", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: context.orderId },
    });
    const snapshot = order.shippingAddressSnapshot as Record<string, unknown>;

    expect(snapshot.name).toBeTruthy();
    expect(snapshot.addressLine1).toBeTruthy();
    expect(snapshot.city).toBe("Mumbai");
    expect(snapshot.postalCode).toBe("400001");
  });

  it("deducts inventory when payment is verified and order is placed", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);

    const inventoryBefore = await prisma.inventory.findUnique({
      where: { productId: context.productId },
    });
    expect(inventoryBefore?.availableQuantity).toBe(50);

    const createRes = await createRazorpayOrderForContext(app, context);
    const razorpayOrderId = createRes.body.data.razorpayOrderId as string;
    const razorpayPaymentId = randomRazorpayPaymentId();

    const verifyRes = await paymentRequest(
      app,
      context.buyerAuth.accessToken,
    ).verify(
      {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: createPaymentSignature(
          razorpayOrderId,
          razorpayPaymentId,
        ),
      },
      newIdempotencyKey("verify-inventory"),
    );
    expect(verifyRes.status).toBe(200);

    const inventoryAfter = await prisma.inventory.findUnique({
      where: { productId: context.productId },
    });
    expect(inventoryAfter?.availableQuantity).toBe(48);

    const deduction = await prisma.inventoryMovement.findFirst({
      where: {
        referenceId: context.orderId,
        productId: context.productId,
        movementType: "ORDER_DEDUCTION",
      },
    });
    expect(deduction).not.toBeNull();
    expect(deduction?.quantityChanged).toBe(-2);
  });

  it("rejects checkout with an empty cart", async () => {
    const app = getApp();
    const { auth: buyerAuth } = await registerBuyerViaApi(app);

    const addressRes = await addressRequest(
      app,
      buyerAuth.accessToken,
    ).create(addressCreationPayload());
    const addressId = addressRes.body.data.id as string;

    const res = await orderRequest(app, buyerAuth.accessToken).checkout(
      { shippingAddressId: addressId },
      newIdempotencyKey("empty-cart"),
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cart is empty/i);
  });

  it("rejects checkout when inventory is insufficient", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const marketplace = await setupMarketplaceProduct(app, prisma, {
      inventoryQuantity: 2,
    });
    const { auth: buyerAuth } = await registerBuyerViaApi(app);

    const addressRes = await addressRequest(
      app,
      buyerAuth.accessToken,
    ).create(addressCreationPayload());
    const addressId = addressRes.body.data.id as string;

    await cartRequest(app, buyerAuth.accessToken).addItem({
      productId: marketplace.productId,
      quantity: 2,
    });

    await prisma.inventory.update({
      where: { productId: marketplace.productId },
      data: { availableQuantity: 1 },
    });

    const res = await orderRequest(app, buyerAuth.accessToken).checkout(
      { shippingAddressId: addressId },
      newIdempotencyKey("low-stock"),
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/insufficient inventory/i);
  });
});
