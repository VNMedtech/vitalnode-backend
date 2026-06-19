import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { INSUFFICIENT_INVENTORY_FULFILLMENT_MESSAGE } from "../../../src/modules/payments/constants/payment.constants.js";
import {
  checkoutCart,
  prepareBuyerCart,
  setupLowStockMarketplace,
} from "./helpers.js";
import { getTestPrisma } from "../../utils/db.js";
import {
  createPaymentSignature,
  newIdempotencyKey,
} from "../../utils/payment.helpers.js";
import { orderRequest, paymentRequest } from "../../utils/request.helpers.js";
import { useCommerceE2ELifecycle } from "./setup.js";

describe("E2E Commerce — Scenario 4: Inventory Edge Case", () => {
  const { getApp } = useCommerceE2ELifecycle();

  it("prevents overselling when two buyers compete for the last unit", async () => {
    const app = getApp();
    const prisma = getTestPrisma();

    const marketplace = await setupLowStockMarketplace(app, prisma, 1);

    const buyerA = await prepareBuyerCart(app, marketplace.productId, 1);
    const buyerB = await prepareBuyerCart(app, marketplace.productId, 1);

    const orderA = await checkoutCart(app, buyerA.buyerToken, buyerA.addressId);
    const orderB = await checkoutCart(app, buyerB.buyerToken, buyerB.addressId);

    expect(orderA.orderId).not.toBe(orderB.orderId);

    const createA = await paymentRequest(app, buyerA.buyerToken).createOrder(
      { orderId: orderA.orderId },
      newIdempotencyKey("e2e-race-a"),
    );
    expect(createA.status).toBe(200);

    const razorpayOrderIdA = createA.body.data.razorpayOrderId as string;
    const razorpayPaymentIdA = `pay_race_a_${randomUUID().slice(0, 8)}`;

    const verifyA = await paymentRequest(app, buyerA.buyerToken).verify(
      {
        razorpayOrderId: razorpayOrderIdA,
        razorpayPaymentId: razorpayPaymentIdA,
        razorpaySignature: createPaymentSignature(
          razorpayOrderIdA,
          razorpayPaymentIdA,
        ),
      },
      newIdempotencyKey("e2e-verify-a"),
    );
    expect(verifyA.status).toBe(200);
    expect(verifyA.body.data.orderStatus).toBe("PLACED");

    const inventoryAfterWinner = await prisma.inventory.findUnique({
      where: { productId: marketplace.productId },
    });
    expect(inventoryAfterWinner?.availableQuantity).toBe(0);

    const createB = await paymentRequest(app, buyerB.buyerToken).createOrder(
      { orderId: orderB.orderId },
      newIdempotencyKey("e2e-race-b"),
    );
    expect(createB.status).toBe(200);

    const razorpayOrderIdB = createB.body.data.razorpayOrderId as string;
    const razorpayPaymentIdB = `pay_race_b_${randomUUID().slice(0, 8)}`;

    const verifyB = await paymentRequest(app, buyerB.buyerToken).verify(
      {
        razorpayOrderId: razorpayOrderIdB,
        razorpayPaymentId: razorpayPaymentIdB,
        razorpaySignature: createPaymentSignature(
          razorpayOrderIdB,
          razorpayPaymentIdB,
        ),
      },
      newIdempotencyKey("e2e-verify-b"),
    );
    expect(verifyB.status).toBe(409);
    expect(verifyB.body.message).toBe(INSUFFICIENT_INVENTORY_FULFILLMENT_MESSAGE);

    const orderBRecord = await prisma.order.findUniqueOrThrow({
      where: { id: orderB.orderId },
      include: { payment: true },
    });
    expect(orderBRecord.orderStatus).toBe("PAYMENT_FAILED");
    expect(orderBRecord.payment?.paymentStatus).toBe("FAILED");

    const inventoryFinal = await prisma.inventory.findUnique({
      where: { productId: marketplace.productId },
    });
    expect(inventoryFinal?.availableQuantity).toBe(0);

    const deductions = await prisma.inventoryMovement.findMany({
      where: {
        productId: marketplace.productId,
        movementType: "ORDER_DEDUCTION",
      },
    });
    expect(deductions).toHaveLength(1);
    expect(deductions[0]?.referenceId).toBe(orderA.orderId);

    const compensationAudit = await prisma.auditLog.findFirst({
      where: { action: "PAYMENT_FULFILLMENT_COMPENSATION" },
    });
    expect(compensationAudit).not.toBeNull();
  });

  it("rejects checkout when advisory inventory check fails", async () => {
    const app = getApp();
    const prisma = getTestPrisma();

    const marketplace = await setupLowStockMarketplace(app, prisma, 2);
    const buyer = await prepareBuyerCart(app, marketplace.productId, 2);

    await prisma.inventory.update({
      where: { productId: marketplace.productId },
      data: { availableQuantity: 1 },
    });

    const res = await orderRequest(app, buyer.buyerToken).checkout(
      { shippingAddressId: buyer.addressId },
      newIdempotencyKey("e2e-low-stock-checkout"),
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/insufficient inventory/i);
  });
});
