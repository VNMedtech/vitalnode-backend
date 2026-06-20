import { describe, expect, it } from "vitest";
import { createAdminActor, setupPaidPaymentOrder } from "../../factories/payment.factory.js";
import { enrichPaidOrderContext } from "../../factories/order.factory.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import {
  analyticsRequest,
  salesReportsRequest,
} from "../../utils/request.helpers.js";
import { useSalesReportsTestLifecycle } from "./setup.js";

describe("Sales Reports — Security", () => {
  const { getApp } = useSalesReportsTestLifecycle();

  it("rejects unauthenticated seller sales report requests", async () => {
    const app = getApp();

    const res = await salesReportsRequest(app, "").getSummary();

    expect(res.status).toBe(401);
  });

  it("rejects buyer access to seller sales reports", async () => {
    const app = getApp();
    const { auth } = await registerBuyerViaApi(app);

    const res = await salesReportsRequest(app, auth.accessToken).getSummary();

    expect(res.status).toBe(403);
  });

  it("rejects seller access to admin platform sales report", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const paid = await setupPaidPaymentOrder(app, prisma);
    const context = await enrichPaidOrderContext(app, prisma, paid);

    const res = await analyticsRequest(
      app,
      context.sellerToken,
    ).getPlatformSalesReport();

    expect(res.status).toBe(403);
  });

  it("rejects seller access to admin seller sales report", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const paid = await setupPaidPaymentOrder(app, prisma);
    const context = await enrichPaidOrderContext(app, prisma, paid);

    const res = await analyticsRequest(
      app,
      context.sellerToken,
    ).listSellerSalesReport();

    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated admin sales report requests", async () => {
    const app = getApp();

    const res = await analyticsRequest(app, "").getPlatformSalesReport();

    expect(res.status).toBe(401);
  });
});
