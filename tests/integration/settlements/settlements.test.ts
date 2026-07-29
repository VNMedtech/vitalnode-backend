import type { Express } from "express";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as s3Module from "../../../src/infrastructure/s3/index.js";
import { SETTLEMENT_ACTIONS } from "../../../src/modules/settlements/constants/settlement.constants.js";
import {
  fulfillOrderThroughDelivery,
  prepareBuyerCart,
  setupLowStockMarketplace,
  verifyPaymentForOrder,
} from "../../e2e/commerce/helpers.js";
import {
  createAdminViaApi,
  createApprovedSeller,
  registerSellerViaApi,
} from "../../factories/user.factory.js";
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

async function getSellerProfileId(
  prisma: ReturnType<typeof getTestPrisma>,
  userId: string,
): Promise<string> {
  const profile = await prisma.sellerProfile.findFirstOrThrow({
    where: { userId },
    select: { id: true },
  });
  return profile.id;
}

async function waitForAuditLog(
  prisma: ReturnType<typeof getTestPrisma>,
  action: string,
  entityId: string,
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const log = await prisma.auditLog.findFirst({
      where: { action, entityId },
    });
    if (log) {
      return log;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

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
    expect(createRes.body.data.seller).toEqual(
      expect.objectContaining({
        id: sellerId,
        businessName: expect.any(String),
        commissionPercentage: expect.anything(),
      }),
    );

    const batchId = createRes.body.data.id as string;

    const adminListRes = await adminSettlementRequest(app, adminToken).list({
      page: "1",
      limit: "20",
      sellerId,
    });
    expect(adminListRes.status).toBe(200);
    const adminListItem = adminListRes.body.data.find(
      (b: { id: string }) => b.id === batchId,
    );
    expect(adminListItem).toBeDefined();
    expect(adminListItem.seller).toEqual({
      id: sellerId,
      businessName: expect.any(String),
    });
    expect(adminListItem.seller).not.toHaveProperty("commissionPercentage");

    const sellerListRes = await sellerSettlementRequest(
      app,
      sellerToken,
    ).list({ page: "1", limit: "20" });
    expect(sellerListRes.status).toBe(200);
    const sellerListItem = sellerListRes.body.data.find(
      (b: { id: string }) => b.id === batchId,
    );
    expect(sellerListItem?.seller).toEqual({
      id: sellerId,
      businessName: expect.any(String),
    });

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

  it("updates commission for an approved seller", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const seller = await createApprovedSeller(app, prisma);
    const sellerId = await getSellerProfileId(prisma, seller.auth.user.id);

    const res = await adminSettlementRequest(
      app,
      adminLogin.auth.accessToken,
    ).updateSellerCommission(sellerId, { commissionPercentage: 12.5 });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Seller commission updated successfully");
    expect(res.body.data.id).toBe(sellerId);
    expect(res.body.data.commissionPercentage).toBe("12.5");

    const profile = await prisma.sellerProfile.findUniqueOrThrow({
      where: { id: sellerId },
    });
    expect(profile.commissionPercentage?.toString()).toBe("12.5");

    const audit = await waitForAuditLog(
      prisma,
      SETTLEMENT_ACTIONS.COMMISSION_UPDATED,
      sellerId,
    );
    expect(audit).not.toBeNull();
    expect(audit?.actorUserId).toBe(adminLogin.auth.user.id);
    const metadata = audit?.metadata as Record<string, unknown> | null;
    expect(metadata?.previousCommissionPercentage).toBe("10");
    expect(metadata?.newCommissionPercentage).toBe(12.5);
  });

  it("rejects commission update for unapproved sellers", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const pending = await registerSellerViaApi(app);
    const sellerId = await getSellerProfileId(prisma, pending.auth.user.id);

    const res = await adminSettlementRequest(
      app,
      adminLogin.auth.accessToken,
    ).updateSellerCommission(sellerId, { commissionPercentage: 15 });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/approved sellers/i);
  });

  it("rejects invalid commission percentages and unknown sellers", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const seller = await createApprovedSeller(app, prisma);
    const sellerId = await getSellerProfileId(prisma, seller.auth.user.id);
    const token = adminLogin.auth.accessToken;

    const tooHigh = await adminSettlementRequest(app, token).updateSellerCommission(
      sellerId,
      { commissionPercentage: 101 },
    );
    expect(tooHigh.status).toBe(400);

    const missing = await adminSettlementRequest(app, token).updateSellerCommission(
      randomUUID(),
      { commissionPercentage: 8 },
    );
    expect(missing.status).toBe(404);
  });

  it("rejects commission update from non-admin actors", async () => {
    const prisma = getTestPrisma();
    const seller = await createApprovedSeller(app, prisma);
    const sellerId = await getSellerProfileId(prisma, seller.auth.user.id);

    const res = await adminSettlementRequest(
      app,
      seller.login.auth.accessToken,
    ).updateSellerCommission(sellerId, { commissionPercentage: 20 });

    expect(res.status).toBe(403);
  });
});
