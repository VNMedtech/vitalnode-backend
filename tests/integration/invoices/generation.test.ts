import { describe, expect, it } from "vitest";
import { getTestPrisma } from "../../utils/db.js";
import { setupPaidPaymentOrder } from "../../factories/payment.factory.js";
import { InvoiceRepository } from "../../../src/modules/invoices/repositories/invoice.repository.js";
import { useInvoicesTestLifecycle } from "./setup.js";

describe("Invoices — Generation", () => {
  const { getApp } = useInvoicesTestLifecycle();

  it("generates an invoice automatically after successful payment", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPaidPaymentOrder(app, prisma);

    const invoice = await prisma.invoice.findUnique({
      where: { orderId: context.orderId },
    });

    expect(invoice).not.toBeNull();
    expect(invoice?.invoiceNumber).toMatch(/^VN-INV-\d{8}-\d{6}$/);
    expect(invoice?.buyerId).toBeTruthy();
    expect(invoice?.sellerId).toBeTruthy();
    expect(invoice?.pdfUrl).toContain("invoices/");
    expect(invoice?.currency).toBe("INR");
    expect(invoice?.totalAmount.toString()).toBeTruthy();
    expect(invoice?.generatedAt).toBeInstanceOf(Date);
  });

  it("prevents duplicate invoice generation for the same order", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPaidPaymentOrder(app, prisma);

    const repo = new InvoiceRepository(prisma);
    const first = await repo.findByOrderId(context.orderId);
    expect(first).not.toBeNull();

    const count = await prisma.invoice.count({
      where: { orderId: context.orderId },
    });
    expect(count).toBe(1);
  });
});
