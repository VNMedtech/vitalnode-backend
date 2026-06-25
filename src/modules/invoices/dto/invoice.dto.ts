import type { Prisma } from "../../../../generated/prisma/client.js";
import type { InvoiceDetailDto, InvoiceSummaryDto } from "../types/invoice.types.js";

function decimalToString(value: Prisma.Decimal): string {
  return value.toString();
}

function resolvePaymentLifecycleStatus(
  paymentStatus: string,
  refundStatus?: string,
): string {
  if (refundStatus === "SUCCESS") {
    return "REFUNDED";
  }
  if (paymentStatus === "SUCCESS") {
    return "PAID";
  }
  if (paymentStatus === "FAILED") {
    return "FAILED";
  }
  return "PENDING";
}

type InvoiceWithOrder = Prisma.InvoiceGetPayload<{
  include: {
    order: {
      select: {
        orderNumber: true;
        payment: {
          select: {
            razorpayPaymentId: true;
            paymentStatus: true;
            refundStatus: true;
          };
        };
      };
    };
  };
}>;

export function toInvoiceSummaryDto(
  record: InvoiceWithOrder,
  downloadUrl: string,
): InvoiceSummaryDto {
  return {
    id: record.id,
    invoiceNumber: record.invoiceNumber,
    orderId: record.orderId,
    orderNumber: record.order.orderNumber,
    buyerId: record.buyerId,
    sellerId: record.sellerId,
    totalAmount: decimalToString(record.totalAmount),
    currency: record.currency,
    generatedAt: record.generatedAt.toISOString(),
    downloadUrl,
  };
}

export function toInvoiceDetailDto(
  record: InvoiceWithOrder,
  downloadUrl: string,
): InvoiceDetailDto {
  const payment = record.order.payment;

  return {
    ...toInvoiceSummaryDto(record, downloadUrl),
    pdfUrl: record.pdfUrl,
    paymentReference: payment?.razorpayPaymentId ?? null,
    paymentStatus: payment
      ? resolvePaymentLifecycleStatus(
          payment.paymentStatus,
          payment.refundStatus,
        )
      : "PENDING",
  };
}
