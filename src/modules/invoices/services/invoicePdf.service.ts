import PDFDocument from "pdfkit";
import type { InvoicePdfData } from "../types/invoice.types.js";

function formatCurrency(amount: string, currency: string): string {
  return `${currency} ${formatMoney(amount)}`;
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

function formatMoney(amount: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return value.toFixed(2);
}

function formatPercent(amount: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function discountLabel(data: InvoicePdfData): string | null {
  const amount = Number(data.discountAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const code = data.couponCode?.trim();
  const percent = data.discountPercent ? formatPercent(data.discountPercent) : null;
  if (code && percent) return `Discount (${code}, ${percent}% off)`;
  if (code) return `Discount (${code})`;
  if (percent) return `Discount (${percent}% off)`;
  return "Discount";
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", compress: false });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const leftX = 50;
    const contentWidth = 495;
    const columnGap = 28;
    const columnWidth = (contentWidth - columnGap) / 2;
    const rightX = leftX + columnWidth + columnGap;

    doc
      .fontSize(22)
      .fillColor("#1a365d")
      .text(data.platformName, leftX, doc.y, { align: "center", width: contentWidth });
    doc.moveDown(0.3);
    doc.fontSize(16).fillColor("#000000").text("TAX INVOICE", leftX, doc.y, {
      align: "center",
      width: contentWidth,
    });
    doc.moveDown(1.2);

    doc.fontSize(10).fillColor("#333333");
    doc.text(`Invoice Number: ${data.invoiceNumber}`, leftX, doc.y, { width: contentWidth });
    doc.text(
      `Invoice Date: ${data.invoiceDate.toISOString().slice(0, 10)}`,
      leftX,
      doc.y,
      { width: contentWidth },
    );
    doc.moveDown(1);

    const buyerY = doc.y;
    doc.fontSize(11).fillColor("#000000");
    doc.text("Bill To", leftX, buyerY, { underline: true, width: columnWidth });
    doc.text("Sold By", rightX, buyerY, { underline: true, width: columnWidth });

    const partyY = buyerY + 18;
    const buyerBlock = [
      data.buyer.name,
      data.buyer.phone,
      formatAddressLine(
        data.buyer.addressLine1,
        data.buyer.addressLine2,
        data.buyer.city,
        data.buyer.state,
        data.buyer.postalCode,
        data.buyer.country,
      ),
    ]
      .filter((line) => line.trim().length > 0)
      .join("\n");
    const sellerBlock = [
      data.seller.businessName,
      data.seller.contactPerson,
      formatAddressLine(
        data.seller.addressLine1,
        data.seller.addressLine2,
        data.seller.city,
        data.seller.state,
        data.seller.postalCode,
        data.seller.country,
      ),
    ]
      .filter((line) => line.trim().length > 0)
      .join("\n");

    doc.fontSize(10).fillColor("#333333");
    const buyerHeight = doc.heightOfString(buyerBlock, { width: columnWidth });
    const sellerHeight = doc.heightOfString(sellerBlock, { width: columnWidth });
    doc.text(buyerBlock, leftX, partyY, { width: columnWidth });
    doc.text(sellerBlock, rightX, partyY, { width: columnWidth });

    let cursorY = partyY + Math.max(buyerHeight, sellerHeight) + 22;
    doc.fontSize(11).fillColor("#000000").text("Order Information", leftX, cursorY, {
      underline: true,
      width: contentWidth,
    });
    cursorY += 20;
    doc.fontSize(10).fillColor("#333333");
    doc.text(`Order Number: ${data.orderNumber}`, leftX, cursorY, { width: contentWidth });
    cursorY = doc.y;
    doc.text(
      `Payment Reference: ${data.paymentReference ?? "N/A"}`,
      leftX,
      cursorY,
      { width: contentWidth },
    );
    cursorY = doc.y + 14;

    const tableTop = cursorY;
    const colProduct = leftX;
    const colQty = 300;
    const colUnit = 350;
    const colSubtotal = 450;

    doc.rect(leftX, tableTop, contentWidth, 20).fill("#1a365d");
    doc.fillColor("#ffffff").fontSize(10);
    doc.text("Product", colProduct + 5, tableTop + 5, { width: 230, lineBreak: false });
    doc.text("Qty", colQty, tableTop + 5, { width: 40, lineBreak: false });
    doc.text("Unit Price", colUnit, tableTop + 5, { width: 90, lineBreak: false });
    doc.text("Subtotal", colSubtotal, tableTop + 5, { width: 90, lineBreak: false });

    let rowY = tableTop + 28;
    doc.fillColor("#333333");

    for (const item of data.items) {
      const nameHeight = doc.heightOfString(item.productName, { width: 230 });
      doc.text(item.productName, colProduct + 5, rowY, { width: 230 });
      doc.text(String(item.quantity), colQty, rowY, { width: 40, lineBreak: false });
      doc.text(formatCurrency(item.unitPrice, data.currency), colUnit, rowY, {
        width: 90,
        lineBreak: false,
      });
      doc.text(formatCurrency(item.subtotal, data.currency), colSubtotal, rowY, {
        width: 90,
        lineBreak: false,
      });
      rowY += Math.max(nameHeight, 14) + 8;
    }

    const totalsX = 300;
    const totalsWidth = leftX + contentWidth - totalsX;
    let totalsY = rowY + 16;
    doc.fontSize(10).fillColor("#333333");
    doc.text(
      `Subtotal: ${formatCurrency(data.subtotal, data.currency)}`,
      totalsX,
      totalsY,
      { width: totalsWidth, align: "right" },
    );
    totalsY = doc.y + 4;

    const discount = discountLabel(data);
    if (discount) {
      doc.text(
        `${discount}: -${formatCurrency(data.discountAmount, data.currency)}`,
        totalsX,
        totalsY,
        { width: totalsWidth, align: "right" },
      );
      totalsY = doc.y + 4;
    }

    doc.fontSize(11).fillColor("#000000");
    doc.text(
      `Grand Total: ${formatCurrency(data.grandTotal, data.currency)}`,
      totalsX,
      totalsY,
      { width: totalsWidth, align: "right" },
    );
    totalsY = doc.y + 16;
    doc.fontSize(10).fillColor("#333333");
    doc.text(`Payment Status: ${data.paymentStatus}`, leftX, totalsY, { width: contentWidth });
    totalsY = doc.y + 8;
    doc.fontSize(9).fillColor("#666666");
    doc.text(
      "GST Included: All prices shown are inclusive of applicable GST where required.",
      leftX,
      totalsY,
      { width: contentWidth },
    );

    doc.end();
  });
}
