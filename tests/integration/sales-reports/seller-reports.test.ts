import { describe, expect, it } from "vitest";
import {
  setupCancelledPaidOrder,
  setupPaidPaymentOrder,
} from "../../factories/payment.factory.js";
import {
  enrichPaidOrderContext,
  setupDeliveredOrder,
} from "../../factories/order.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { salesReportsRequest } from "../../utils/request.helpers.js";
import { useSalesReportsTestLifecycle } from "./setup.js";

describe("Sales Reports — Seller", () => {
  const { getApp } = useSalesReportsTestLifecycle();

  it("returns sales summary with order counts, revenue, and top products", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const paid = await setupPaidPaymentOrder(app, prisma);
    const context = await enrichPaidOrderContext(app, prisma, paid);

    const res = await salesReportsRequest(app, context.sellerToken).getSummary();

    expect(res.status).toBe(200);
    expect(res.body.data.totalOrders).toBe(1);
    expect(res.body.data.completedOrders).toBe(0);
    expect(res.body.data.cancelledOrders).toBe(0);
    expect(Number(res.body.data.revenue)).toBeGreaterThan(0);
    expect(res.body.data.topProducts).toHaveLength(1);
    expect(res.body.data.topProducts[0].productId).toBe(context.productId);
  });

  it("returns orders summary with status breakdown", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const paid = await setupPaidPaymentOrder(app, prisma);
    const context = await enrichPaidOrderContext(app, prisma, paid);

    const res = await salesReportsRequest(app, context.sellerToken).getOrders();

    expect(res.status).toBe(200);
    expect(res.body.data.totalOrders).toBe(1);
    expect(res.body.data.byStatus.PLACED).toBe(1);
    expect(res.body.data.ordersInPeriod).toBe(1);
  });

  it("counts completed orders after delivery", async () => {
    const app = getApp();
    const prisma = getTestPrisma();

    const delivered = await setupDeliveredOrder(app, prisma);

    const res = await salesReportsRequest(app, delivered.sellerToken).getOrders();
    expect(res.status).toBe(200);
    expect(res.body.data.completedOrders).toBe(1);
  });

  it("counts cancelled orders after buyer cancellation", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const cancelled = await setupCancelledPaidOrder(app, prisma);
    const context = await enrichPaidOrderContext(app, prisma, cancelled);

    const res = await salesReportsRequest(app, context.sellerToken).getOrders();
    expect(res.status).toBe(200);
    expect(res.body.data.cancelledOrders).toBe(1);
  });

  it("returns revenue summary with buckets", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const paid = await setupPaidPaymentOrder(app, prisma);
    const context = await enrichPaidOrderContext(app, prisma, paid);

    const res = await salesReportsRequest(app, context.sellerToken).getRevenue({
      groupBy: "day",
    });

    expect(res.status).toBe(200);
    expect(Number(res.body.data.totalRevenue)).toBeGreaterThan(0);
    expect(res.body.data.successfulPayments).toBe(1);
    expect(res.body.data.buckets.length).toBeGreaterThanOrEqual(1);
  });

  it("filters by month and year", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const paid = await setupPaidPaymentOrder(app, prisma);
    const context = await enrichPaidOrderContext(app, prisma, paid);

    const now = new Date();
    const res = await salesReportsRequest(app, context.sellerToken).getSummary({
      month: now.getUTCMonth() + 1,
      year: now.getUTCFullYear(),
    });

    expect(res.status).toBe(200);
    expect(res.body.data.period).not.toBeNull();
    expect(res.body.data.totalOrders).toBe(1);
  });
});
