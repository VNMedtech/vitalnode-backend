import PDFDocument from "pdfkit";
import type { InvoicePdfData } from "../types/invoice.types.js";

function formatCurrency(amount: string, currency: string): string {
  return `${currency} ${amount}`;
}

function formatAddressLine(
  line1: string,
  line2: string | null,
  city: string,
  state: string,
  postalCode: string,
  country: string,
): string {
  const parts = [line1];
  if (line2) {
    parts.push(line2);
  }
  parts.push(`${city}, ${state} ${postalCode}`);
  parts.push(country);
  return parts.join("\n");
}

export function buildInvoiceS3Key(invoiceNumber: string): string {
  return `invoices/${invoiceNumber}.pdf`;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const leftX = 50;
    const rightX = 350;

    doc
      .fontSize(22)
      .fillColor("#1a365d")
      .text(data.platformName, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(16).fillColor("#000000").text("TAX INVOICE", { align: "center" });
    doc.moveDown(1.2);

    doc.fontSize(10).fillColor("#333333");
    doc.text(`Invoice Number: ${data.invoiceNumber}`, leftX);
    doc.text(
      `Invoice Date: ${data.invoiceDate.toISOString().slice(0, 10)}`,
      leftX,
    );
    doc.moveDown(1);

    const buyerY = doc.y;
    doc.fontSize(11).fillColor("#000000").text("Bill To", leftX, buyerY, {
      underline: true,
    });
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#333333");
    doc.text(data.buyer.name, leftX);
    doc.text(data.buyer.phone, leftX);
    doc.text(
      formatAddressLine(
        data.buyer.addressLine1,
        data.buyer.addressLine2,
        data.buyer.city,
        data.buyer.state,
        data.buyer.postalCode,
        data.buyer.country,
      ),
      leftX,
    );

    doc.fontSize(11).fillColor("#000000").text("Sold By", rightX, buyerY, {
      underline: true,
    });
    doc.fontSize(10).fillColor("#333333");
    doc.text(data.seller.businessName, rightX, buyerY + 16);
    doc.text(data.seller.contactPerson, rightX);
    doc.text(
      formatAddressLine(
        data.seller.addressLine1,
        data.seller.addressLine2,
        data.seller.city,
        data.seller.state,
        data.seller.postalCode,
        data.seller.country,
      ),
      rightX,
    );

    doc.moveDown(2.5);
    doc.fontSize(11).fillColor("#000000").text("Order Information", leftX, doc.y, {
      underline: true,
    });
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#333333");
    doc.text(`Order Number: ${data.orderNumber}`, leftX);
    doc.text(
      `Payment Reference: ${data.paymentReference ?? "N/A"}`,
      leftX,
    );
    doc.moveDown(1);

    const tableTop = doc.y;
    const colProduct = leftX;
    const colQty = 280;
    const colUnit = 330;
    const colSubtotal = 430;

    doc.fontSize(10).fillColor("#ffffff");
    doc.rect(leftX, tableTop, 495, 20).fill("#1a365d");
    doc.fillColor("#ffffff");
    doc.text("Product", colProduct + 5, tableTop + 5);
    doc.text("Qty", colQty, tableTop + 5);
    doc.text("Unit Price", colUnit, tableTop + 5);
    doc.text("Subtotal", colSubtotal, tableTop + 5);

    let rowY = tableTop + 24;
    doc.fillColor("#333333");

    for (const item of data.items) {
      doc.text(item.productName, colProduct + 5, rowY, { width: 210 });
      doc.text(String(item.quantity), colQty, rowY);
      doc.text(formatCurrency(item.unitPrice, data.currency), colUnit, rowY);
      doc.text(formatCurrency(item.subtotal, data.currency), colSubtotal, rowY);
      rowY += 22;
    }

    doc.moveDown(2);
    const totalsY = Math.max(rowY + 10, doc.y);
    doc.fontSize(11).fillColor("#000000");
    doc.text(
      `Grand Total: ${formatCurrency(data.grandTotal, data.currency)}`,
      rightX,
      totalsY,
      { align: "left" },
    );
    doc.moveDown(0.8);
    doc.fontSize(10).fillColor("#333333");
    doc.text(`Payment Status: ${data.paymentStatus}`, leftX);
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor("#666666");
    doc.text(
      "GST Included: All prices shown are inclusive of applicable GST where required.",
      leftX,
      doc.y,
      { width: 495 },
    );

    doc.end();
  });
}
