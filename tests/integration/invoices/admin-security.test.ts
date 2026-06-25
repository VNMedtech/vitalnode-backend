import { describe, expect, it } from "vitest";
import {
  createAdminActor,
  setupPaidPaymentOrder,
} from "../../factories/payment.factory.js";
import { createApprovedSeller } from "../../factories/user.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import {
  adminInvoiceRequest,
  buyerInvoiceRequest,
} from "../../utils/request.helpers.js";
import { signInvalidAccessToken } from "../../utils/jwt.helpers.js";
import { useInvoicesTestLifecycle } from "./setup.js";

describe("Invoices — Admin Access", () => {
  const { getApp } = useInvoicesTestLifecycle();

  it("lists all invoices for admin", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPaidPaymentOrder(app, prisma);
    const adminToken = await createAdminActor(app, prisma);

    const res = await adminInvoiceRequest(app, adminToken).list();

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ orderId: context.orderId }),
      ]),
    );
  });

  it("returns invoice detail by ID for admin", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    await setupPaidPaymentOrder(app, prisma);
    const adminToken = await createAdminActor(app, prisma);
    const invoice = await prisma.invoice.findFirstOrThrow();

    const res = await adminInvoiceRequest(app, adminToken).getById(invoice.id);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(invoice.id);
    expect(res.body.data.downloadUrl).toContain("https://");
  });
});

describe("Invoices — Security", () => {
  const { getApp } = useInvoicesTestLifecycle();

  it("rejects unauthenticated buyer invoice access", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPaidPaymentOrder(app, prisma);

    const listRes = await buyerInvoiceRequest(app).list();
    expect(listRes.status).toBe(401);

    const orderRes = await buyerInvoiceRequest(app).getByOrderId(
      context.orderId,
    );
    expect(orderRes.status).toBe(401);
  });

  it("rejects seller access to admin invoice endpoints", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    await setupPaidPaymentOrder(app, prisma);
    const seller = await createApprovedSeller(app, prisma);

    const res = await adminInvoiceRequest(
      app,
      seller.login.auth.accessToken,
    ).list();

    expect(res.status).toBe(403);
  });

  it("rejects invalid tokens on admin invoice endpoints", async () => {
    const app = getApp();
    const invalidToken = signInvalidAccessToken({ sub: "fake-user-id" });

    const res = await adminInvoiceRequest(app, invalidToken).list();
    expect(res.status).toBe(401);
  });
});
