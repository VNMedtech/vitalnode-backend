import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as s3Module from "../../../src/infrastructure/s3/index.js";
import {
  fulfillOrderThroughDelivery,
  prepareBuyerCart,
  setupLowStockMarketplace,
  verifyPaymentForOrder,
} from "../../e2e/commerce/helpers.js";
import { mockRazorpayLayer } from "../../mocks/razorpay.mock.js";
import {
  adminSettlementRequest,
  orderRequest,
  sellerSettlementRequest,
} from "../../utils/request.helpers.js";
import { newIdempotencyKey } from "../../utils/payment.helpers.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { getTestApp } from "../../utils/testApp.js";

function mockS3Layer(): void {
  vi.spyOn(s3Module, "uploadObjectToS3").mockResolvedValue({
    key: "uploads/orders/mock-proof.png",
    bucket: "medical-test-bucket",
    etag: "mock-etag",
  });
  vi.spyOn(s3Module, "deleteObjectFromS3").mockResolvedValue(undefined);
  vi.spyOn(s3Module, "generateSignedDownloadUrl").mockResolvedValue(
    "https://signed.example.com/mock-proof",
  );
}

describe("Settlements — Admin and Seller", () => {
  let app: Express;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetDatabase();
    mockRazorpayLayer();
    mockS3Layer();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  async function deliverPaidOrder() {
    const prisma = getTestPrisma();
    const marketplace = await setupLowStockMarketplace(app, prisma, 20);
    const buyer = await prepareBuyerCart(app, marketplace.productId, 1);
    const checkout = await orderRequest(app, buyer.buyerToken).checkout(
      { shippingAddressId: buyer.addressId },
      newIdempotencyKey("settlement-checkout"),
    );
    expect(checkout.status).toBe(201);
    const orderId = checkout.body.data.orderId as string;

    const payment = await verifyPaymentForOrder(app, buyer.buyerToken, orderId);
    expect(payment.verifyRes.status).toBe(200);

    await fulfillOrderThroughDelivery(
      app,
      {
        orderId,
        adminToken: marketplace.adminToken,
        sellerToken: marketplace.sellerToken,
      },
      prisma,
    );

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });

    return {
      prisma,
      adminToken: marketplace.adminToken,
      sellerToken: marketplace.sellerToken,
      sellerId: order.sellerId,
      orderId,
      order,
    };
  }

  it("calculates commission when order is delivered", async () => {
    const { order } = await deliverPaidOrder();

    expect(order.orderStatus).toBe("PENDING_SETTLEMENT");
    expect(order.grossAmount?.toString()).toBe(order.totalAmount.toString());
    expect(order.commissionPercentageSnapshot?.toString()).toBe("10");
    expect(order.commissionAmount).not.toBeNull();
    expect(order.sellerReceivableAmount).not.toBeNull();
  });

  it("creates and disburses a settlement batch", async () => {
    const { adminToken, sellerToken, sellerId, orderId, order } =
      await deliverPaidOrder();

    const createRes = await adminSettlementRequest(app, adminToken).create({
      sellerId,
      orderIds: [orderId],
      remarks: "Monthly payout",
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe("PENDING");
    expect(createRes.body.data.orderCount).toBe(1);

    const batchId = createRes.body.data.id as string;

    const disburseRes = await adminSettlementRequest(app, adminToken).disburse(
      batchId,
      { paymentReference: "NEFT-123456" },
    );

    expect(disburseRes.status).toBe(200);
    expect(disburseRes.body.data.status).toBe("DISBURSED");

    const prisma = getTestPrisma();
    const settledOrder = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(settledOrder.orderStatus).toBe("SETTLED");

    const earningsRes =
      await sellerSettlementRequest(app, sellerToken).earningsSummary();
    expect(earningsRes.status).toBe(200);
    expect(earningsRes.body.data.completedSettlements.batchCount).toBe(1);
    expect(earningsRes.body.data.grossRevenue).toBe(
      order.grossAmount?.toString(),
    );
  });

  it("rejects duplicate settlement for the same order", async () => {
    const { adminToken, sellerId, orderId } = await deliverPaidOrder();

    const first = await adminSettlementRequest(app, adminToken).create({
      sellerId,
      orderIds: [orderId],
    });
    expect(first.status).toBe(201);

    const duplicate = await adminSettlementRequest(app, adminToken).create({
      sellerId,
      orderIds: [orderId],
    });
    expect(duplicate.status).toBe(409);
  });

  it("rejects settlement when orders belong to different sellers", async () => {
    const prisma = getTestPrisma();
    const first = await deliverPaidOrder();
    const second = await deliverPaidOrder();

    const res = await adminSettlementRequest(app, first.adminToken).create({
      sellerId: first.sellerId,
      orderIds: [first.orderId, second.orderId],
    });

    expect(res.status).toBe(409);
    expect(second.sellerId).not.toBe(first.sellerId);
  });
});
