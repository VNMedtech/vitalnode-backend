import { describe, expect, it } from "vitest";
import { createAdminActor, setupPaidPaymentOrder } from "../../factories/payment.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { analyticsRequest } from "../../utils/request.helpers.js";
import { useSalesReportsTestLifecycle } from "./setup.js";

describe("Sales Reports — Admin", () => {
  const { getApp } = useSalesReportsTestLifecycle();

  it("returns platform sales report with revenue and volume metrics", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    await setupPaidPaymentOrder(app, prisma);
    const adminToken = await createAdminActor(app, prisma);

    const res = await analyticsRequest(app, adminToken).getPlatformSalesReport();

    expect(res.status).toBe(200);
    expect(Number(res.body.data.totalRevenue)).toBeGreaterThan(0);
    expect(Number(res.body.data.sellerRevenue)).toBeGreaterThan(0);
    expect(res.body.data.orderVolume).toBe(1);
    expect(res.body.data.productVolume).toBe(2);
  });

  it("returns paginated seller sales report", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const paid = await setupPaidPaymentOrder(app, prisma);
    const adminToken = await createAdminActor(app, prisma);
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: paid.orderId },
      select: { sellerId: true },
    });

    const res = await analyticsRequest(app, adminToken).listSellerSalesReport({
      page: 1,
      limit: 10,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);

    const sellerRow = res.body.data.find(
      (row: { sellerId: string }) => row.sellerId === order.sellerId,
    );
    expect(sellerRow).toBeDefined();
    expect(Number(sellerRow.totalRevenue)).toBeGreaterThan(0);
    expect(sellerRow.orderVolume).toBeGreaterThanOrEqual(1);
    expect(sellerRow.productVolume).toBeGreaterThanOrEqual(1);
  });

  it("filters platform report by year", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    await setupPaidPaymentOrder(app, prisma);
    const adminToken = await createAdminActor(app, prisma);

    const res = await analyticsRequest(app, adminToken).getPlatformSalesReport({
      year: new Date().getUTCFullYear(),
    });

    expect(res.status).toBe(200);
    expect(res.body.data.period).not.toBeNull();
    expect(res.body.data.orderVolume).toBe(1);
  });
});
