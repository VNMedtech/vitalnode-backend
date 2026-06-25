import type { Prisma } from "../../../../generated/prisma/client.js";
import type { InvoiceSortField } from "../validators/invoice.schema.js";

export interface InvoiceSummaryDto {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  buyerId: string;
  sellerId: string;
  totalAmount: string;
  currency: string;
  generatedAt: string;
  downloadUrl: string;
}

export interface InvoiceDetailDto extends InvoiceSummaryDto {
  pdfUrl: string;
  paymentReference: string | null;
  paymentStatus: string;
}

export interface ListInvoicesQuery {
  page: number;
  limit: number;
  sortBy: InvoiceSortField;
  sortOrder: "asc" | "desc";
  search?: string;
}

export interface InvoicePdfLineItem {
  productName: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

export interface InvoicePdfData {
  platformName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  buyer: {
    name: string;
    phone: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  seller: {
    businessName: string;
    contactPerson: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  orderNumber: string;
  paymentReference: string | null;
  items: InvoicePdfLineItem[];
  grandTotal: string;
  currency: string;
  paymentStatus: string;
}

export type InvoiceRecord = Prisma.InvoiceGetPayload<{
  include: {
    order: {
      select: {
        orderNumber: true;
        payment: {
          select: {
            razorpayPaymentId: true;
            paymentStatus: true;
          };
        };
      };
    };
  };
}>;
