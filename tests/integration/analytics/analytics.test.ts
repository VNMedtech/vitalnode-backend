import { describe, expect, it } from "vitest";
import {
  createAdminActor,
  setupPaidPaymentOrder,
} from "../../factories/payment.factory.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { analyticsRequest } from "../../utils/request.helpers.js";
import { useSalesReportsTestLifecycle } from "../sales-reports/setup.js";

describe("Analytics — Admin dashboard endpoints", () => {
  const { getApp } = useSalesReportsTestLifecycle();

  it("returns dashboard and core statistic endpoints for admin", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    await setupPaidPaymentOrder(app, prisma);
    const adminToken = await createAdminActor(app, prisma);

    const dashboard = await analyticsRequest(app, adminToken).dashboard();
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.message).toBe(
      "Dashboard summary fetched successfully",
    );
    expect(dashboard.body.data).toEqual(
      expect.objectContaining({
        totalUsers: expect.any(Number),
        totalBuyers: expect.any(Number),
        totalSellers: expect.any(Number),
        totalProducts: expect.any(Number),
        totalOrders: expect.any(Number),
        totalRevenue: expect.any(String),
        lowStockProducts: expect.any(Number),
        generatedAt: expect.any(String),
      }),
    );
    expect(dashboard.body.data.totalOrders).toBeGreaterThanOrEqual(1);

    const users = await analyticsRequest(app, adminToken).users();
    expect(users.status).toBe(200);
    expect(users.body.data.byRole).toEqual(
      expect.objectContaining({
        admin: expect.any(Number),
        buyer: expect.any(Number),
        seller: expect.any(Number),
      }),
    );

    const sellers = await analyticsRequest(app, adminToken).sellers();
    expect(sellers.status).toBe(200);
    expect(sellers.body.data.byApprovalStatus).toEqual(
      expect.objectContaining({
        active: expect.any(Number),
        pendingApproval: expect.any(Number),
      }),
    );

    const products = await analyticsRequest(app, adminToken).products();
    expect(products.status).toBe(200);
    expect(products.body.data.totalProducts).toBeGreaterThanOrEqual(1);

    const orders = await analyticsRequest(app, adminToken).orders();
    expect(orders.status).toBe(200);
    expect(orders.body.data.totalOrders).toBeGreaterThanOrEqual(1);
    expect(orders.body.data.byStatus).toEqual(expect.any(Object));

    const revenue = await analyticsRequest(app, adminToken).revenue({
      groupBy: "day",
    });
    expect(revenue.status).toBe(200);
    expect(revenue.body.data.totalRevenue).toEqual(expect.any(String));
    expect(Number(revenue.body.data.totalRevenue)).toBeGreaterThan(0);

    const commission = await analyticsRequest(app, adminToken).commission();
    expect(commission.status).toBe(200);
    expect(commission.body.data).toEqual(
      expect.objectContaining({
        totalPlatformCommission: expect.any(String),
        commissionInPeriod: expect.any(String),
        commissionBySeller: expect.any(Array),
      }),
    );

    const alerts = await analyticsRequest(app, adminToken).inventoryAlerts({
      page: 1,
      limit: 10,
    });
    expect(alerts.status).toBe(200);
    expect(Array.isArray(alerts.body.data)).toBe(true);
    expect(alerts.body.meta).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 10,
        total: expect.any(Number),
      }),
    );
  });

  it("rejects non-admin and unauthenticated analytics access", async () => {
    const app = getApp();
    const { auth } = await registerBuyerViaApi(app);

    const buyerRes = await analyticsRequest(app, auth.accessToken).dashboard();
    expect(buyerRes.status).toBe(403);

    const anonRes = await analyticsRequest(app, "").dashboard();
    expect(anonRes.status).toBe(401);
  });
});
