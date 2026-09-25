import { describe, expect, it } from "vitest";
import { generateInvoicePdf } from "../../../src/modules/invoices/services/invoicePdf.service.js";
import type { InvoicePdfData } from "../../../src/modules/invoices/types/invoice.types.js";

function sampleInvoice(overrides: Partial<InvoicePdfData> = {}): InvoicePdfData {
  return {
    platformName: "VitalNode",
    invoiceNumber: "VN-INV-20260923-000001",
    invoiceDate: new Date("2026-09-23T00:00:00.000Z"),
    buyer: {
      name: "test",
      phone: "74123698520",
      addressLine1:
        "First-floor, SCO 52, Sector 82, JLPL Industrial Area, Sahibzada Ajit Singh Nagar",
      addressLine2: null,
      city: "Chandigarh",
      state: "punjab",
      country: "India",
      postalCode: "743652",
    },
    seller: {
      businessName: "MediTech Instruments Pvt. Ltd.",
      contactPerson: "Rajesh Mehta",
      addressLine1: "Singh Nagar Estate Road",
      addressLine2: "Phase 2, Andheri East",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      postalCode: "400069",
    },
    orderNumber: "ORD-2026000005",
    paymentReference: "pay_TftsjXYk4d4XuZ",
    items: [
      {
        productName: "VitalNode Seed Pulse Oximeter",
        quantity: 1,
        unitPrice: "8999",
        subtotal: "8999",
      },
    ],
    subtotal: "8999",
    discountAmount: "899.9",
    discountPercent: "10",
    couponCode: "SAVE10",
    grandTotal: "8099.1",
    currency: "INR",
    paymentStatus: "PAID",
    ...overrides,
  };
}

function pdfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  return [...raw.matchAll(/<([0-9A-Fa-f]+)>/g)]
    .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
    .join("");
}

describe("generateInvoicePdf", () => {
  it("prints the coupon discount between the line price and the grand total", async () => {
    const pdf = await generateInvoicePdf(sampleInvoice());
    const text = pdfText(pdf);

    expect(text).toContain("Subtotal: INR 8999.00");
    expect(text).toContain("Discount (SAVE10, 10% off): -INR 899.90");
    expect(text).toContain("Grand Total: INR 8099.10");
    expect(text).toContain("VitalNode Seed Pulse Oximeter");
    expect(text).toContain("Sahibzada Ajit Singh Nagar");
    expect(text).toContain("MediTech Instruments Pvt. Ltd.");
  });

  it("omits the discount line when no coupon was applied", async () => {
    const pdf = await generateInvoicePdf(
      sampleInvoice({
        discountAmount: "0",
        discountPercent: null,
        couponCode: null,
        grandTotal: "8999",
      }),
    );
    const text = pdfText(pdf);

    expect(text).not.toContain("Discount");
    expect(text).toContain("Grand Total: INR 8999.00");
  });
});
