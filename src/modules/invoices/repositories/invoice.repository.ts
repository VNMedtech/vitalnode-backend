import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import { INVOICE_NUMBER_PREFIX } from "../constants/invoice.constants.js";
import type { ListInvoicesQuery } from "../types/invoice.types.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

const invoiceDetailInclude = {
  order: {
    select: {
      orderNumber: true,
      payment: {
        select: {
          razorpayPaymentId: true,
          paymentStatus: true,
          refundStatus: true,
        },
      },
    },
  },
} satisfies Prisma.InvoiceInclude;

export type InvoiceDetailRecord = Prisma.InvoiceGetPayload<{
  include: typeof invoiceDetailInclude;
}>;

export interface CreateInvoiceInput {
  invoiceNumber: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  totalAmount: Prisma.Decimal;
  currency: string;
  pdfUrl: string;
  generatedAt: Date;
}

export interface FindInvoicesOptions extends ListInvoicesQuery {
  buyerId?: string;
}

function buildInvoiceWhere(
  options: Omit<FindInvoicesOptions, "page" | "limit" | "sortBy" | "sortOrder">,
): Prisma.InvoiceWhereInput {
  const { search, buyerId } = options;

  return {
    ...(buyerId ? { buyerId } : {}),
    ...(search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: "insensitive" } },
            {
              order: {
                orderNumber: { contains: search, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };
}

function formatInvoiceDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export class InvoiceRepository {
  constructor(private readonly db: DbClient) {}

  async generateInvoiceNumber(generatedAt: Date): Promise<string> {
    const dateKey = formatInvoiceDateKey(generatedAt);
    const prefix = `${INVOICE_NUMBER_PREFIX}-${dateKey}`;

    const count = await this.db.invoice.count({
      where: {
        invoiceNumber: { startsWith: prefix },
      },
    });

    return `${prefix}-${String(count + 1).padStart(6, "0")}`;
  }

  create(data: CreateInvoiceInput) {
    return this.db.invoice.create({
      data,
      include: invoiceDetailInclude,
    });
  }

  findById(id: string): Promise<InvoiceDetailRecord | null> {
    return this.db.invoice.findUnique({
      where: { id },
      include: invoiceDetailInclude,
    });
  }

  findByOrderId(orderId: string): Promise<InvoiceDetailRecord | null> {
    return this.db.invoice.findUnique({
      where: { orderId },
      include: invoiceDetailInclude,
    });
  }

  findMany(options: FindInvoicesOptions): Promise<InvoiceDetailRecord[]> {
    const { page, limit, sortBy, sortOrder, ...filters } = options;

    return this.db.invoice.findMany({
      where: buildInvoiceWhere(filters),
      include: invoiceDetailInclude,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  count(
    options: Omit<FindInvoicesOptions, "page" | "limit" | "sortBy" | "sortOrder">,
  ): Promise<number> {
    return this.db.invoice.count({
      where: buildInvoiceWhere(options),
    });
  }
}
