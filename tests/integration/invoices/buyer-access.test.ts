import { describe, expect, it } from "vitest";
import { setupPaidPaymentOrder } from "../../factories/payment.factory.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { buyerInvoiceRequest } from "../../utils/request.helpers.js";
import { useInvoicesTestLifecycle } from "./setup.js";

describe("Invoices — Buyer Access", () => {
  const { getApp } = useInvoicesTestLifecycle();

  it("lists invoices for the authenticated buyer", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPaidPaymentOrder(app, prisma);

    const res = await buyerInvoiceRequest(
      app,
      context.buyerAuth.accessToken,
    ).list();

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      orderId: context.orderId,
      invoiceNumber: expect.stringMatching(/^VN-INV-\d{8}-\d{6}$/),
      downloadUrl: expect.stringContaining("https://"),
    });
  });

  it("returns invoice detail by ID for the owning buyer", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPaidPaymentOrder(app, prisma);
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { orderId: context.orderId },
    });

    const res = await buyerInvoiceRequest(
      app,
      context.buyerAuth.accessToken,
    ).getById(invoice.id);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: invoice.id,
      orderId: context.orderId,
      paymentStatus: "PAID",
      downloadUrl: expect.stringContaining("https://"),
    });
  });

  it("returns invoice by order ID for the owning buyer", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPaidPaymentOrder(app, prisma);

    const res = await buyerInvoiceRequest(
      app,
      context.buyerAuth.accessToken,
    ).getByOrderId(context.orderId);

    expect(res.status).toBe(200);
    expect(res.body.data.orderId).toBe(context.orderId);
    expect(res.body.data.paymentStatus).toBe("PAID");
  });
});

describe("Invoices — Buyer Security", () => {
  const { getApp } = useInvoicesTestLifecycle();

  it("returns 404 when another buyer requests an invoice", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPaidPaymentOrder(app, prisma);
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { orderId: context.orderId },
    });
    const { auth: otherBuyer } = await registerBuyerViaApi(app);

    const res = await buyerInvoiceRequest(
      app,
      otherBuyer.accessToken,
    ).getById(invoice.id);

    expect(res.status).toBe(404);
  });

  it("returns 404 when another buyer requests an order invoice", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPaidPaymentOrder(app, prisma);
    const { auth: otherBuyer } = await registerBuyerViaApi(app);

    const res = await buyerInvoiceRequest(
      app,
      otherBuyer.accessToken,
    ).getByOrderId(context.orderId);

    expect(res.status).toBe(404);
  });
});
