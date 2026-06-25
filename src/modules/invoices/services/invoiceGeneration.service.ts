/**
 * @transaction-owner
 * @idempotent: yes
 * @external-calls: AWS S3 PutObject
 */
import {
  PaymentStatus,
  Prisma,
} from "../../../../generated/prisma/client.js";
import {
  buildS3ObjectUrl,
  uploadObjectToS3,
} from "../../../infrastructure/s3/index.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import { logger } from "../../../infrastructure/logger/logger.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { runInTransaction } from "../../../shared/transactions/runInTransaction.js";
import { recordCommerceAudit } from "../../auditLogs/services/commerceAudit.service.js";
import {
  INVOICE_ACTIONS,
  INVOICE_AUDIT_ENTITY_TYPE,
  INVOICE_DEFAULT_CURRENCY,
  PLATFORM_NAME,
} from "../constants/invoice.constants.js";
import type { InvoiceDetailRecord } from "../repositories/invoice.repository.js";
import { InvoiceRepository } from "../repositories/invoice.repository.js";
import type { InvoicePdfData } from "../types/invoice.types.js";
import {
  buildInvoiceS3Key,
  generateInvoicePdf,
} from "./invoicePdf.service.js";

type OrderForInvoice = Prisma.OrderGetPayload<{
  include: {
    items: true;
    payment: true;
    buyer: {
      include: {
        user: {
          select: {
            firstName: true;
            lastName: true;
          };
        };
      };
    };
    seller: true;
  };
}>;

function parseProductName(snapshot: Prisma.JsonValue): string {
  if (
    typeof snapshot === "object" &&
    snapshot !== null &&
    "productName" in snapshot &&
    typeof snapshot.productName === "string"
  ) {
    return snapshot.productName;
  }
  return "Product";
}

function parseAddressSnapshot(snapshot: Prisma.JsonValue): {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
} {
  const data =
    typeof snapshot === "object" && snapshot !== null
      ? (snapshot as Record<string, unknown>)
      : {};

  return {
    name: String(data.name ?? ""),
    phone: String(data.phone ?? ""),
    addressLine1: String(data.addressLine1 ?? ""),
    addressLine2:
      data.addressLine2 === null || data.addressLine2 === undefined
        ? null
        : String(data.addressLine2),
    city: String(data.city ?? ""),
    state: String(data.state ?? ""),
    country: String(data.country ?? ""),
    postalCode: String(data.postalCode ?? ""),
  };
}

function buildPdfData(
  order: OrderForInvoice,
  invoiceNumber: string,
  generatedAt: Date,
): InvoicePdfData {
  const buyerAddress = parseAddressSnapshot(order.shippingAddressSnapshot);

  return {
    platformName: PLATFORM_NAME,
    invoiceNumber,
    invoiceDate: generatedAt,
    buyer: buyerAddress,
    seller: {
      businessName: order.seller.businessName,
      contactPerson: order.seller.contactPerson,
      addressLine1: order.seller.addressLine1,
      addressLine2: order.seller.addressLine2,
      city: order.seller.city,
      state: order.seller.state,
      country: order.seller.country,
      postalCode: order.seller.postalCode,
    },
    orderNumber: order.orderNumber,
    paymentReference: order.payment?.razorpayPaymentId ?? null,
    items: order.items.map((item) => ({
      productName: parseProductName(item.productSnapshot),
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      subtotal: item.totalPrice.toString(),
    })),
    grandTotal: order.totalAmount.toString(),
    currency: INVOICE_DEFAULT_CURRENCY,
    paymentStatus: "PAID",
  };
}

export class InvoiceGenerationService {
  private readonly invoiceRepo = new InvoiceRepository(prisma);

  async generateForOrder(
    orderId: string,
    actorUserId?: string,
  ): Promise<InvoiceDetailRecord> {
    const existing = await this.invoiceRepo.findByOrderId(orderId);
    if (existing) {
      return existing;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payment: true,
        buyer: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        seller: true,
      },
    });

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (!order.payment || order.payment.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new ValidationError(
        "Invoice can only be generated for successfully paid orders",
      );
    }

    const generatedAt = order.placedAt ?? new Date();

    let invoiceNumber: string | undefined;
    let existingInTx: InvoiceDetailRecord | undefined;

    await runInTransaction(async (tx) => {
      const txRepo = new InvoiceRepository(tx);
      const duplicate = await txRepo.findByOrderId(orderId);
      if (duplicate) {
        existingInTx = duplicate;
        return;
      }
      invoiceNumber = await txRepo.generateInvoiceNumber(generatedAt);
    });

    if (existingInTx) {
      return existingInTx;
    }

    if (!invoiceNumber) {
      throw new ConflictError("Invoice number generation failed");
    }

    const pdfData = buildPdfData(order, invoiceNumber, generatedAt);
    const pdfBuffer = await generateInvoicePdf(pdfData);
    const s3Key = buildInvoiceS3Key(invoiceNumber);

    await uploadObjectToS3({
      key: s3Key,
      body: pdfBuffer,
      contentType: "application/pdf",
      contentLength: pdfBuffer.length,
    });

    const pdfUrl = buildS3ObjectUrl(s3Key);

    try {
      const invoice = await runInTransaction(async (tx) => {
        const txRepo = new InvoiceRepository(tx);

        const duplicate = await txRepo.findByOrderId(orderId);
        if (duplicate) {
          return duplicate;
        }

        const created = await txRepo.create({
          invoiceNumber: invoiceNumber as string,
          orderId: order.id,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          totalAmount: order.totalAmount,
          currency: INVOICE_DEFAULT_CURRENCY,
          pdfUrl,
          generatedAt,
        });

        if (actorUserId) {
          await recordCommerceAudit(tx, {
            actorUserId,
            action: INVOICE_ACTIONS.GENERATED,
            entityType: INVOICE_AUDIT_ENTITY_TYPE,
            entityId: created.id,
            metadata: {
              invoiceNumber,
              orderId: order.id,
              orderNumber: order.orderNumber,
            },
          });
        }

        return created;
      });

      return invoice;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await this.invoiceRepo.findByOrderId(orderId);
        if (raced) {
          return raced;
        }
      }

      logger.error({ orderId, error }, "Invoice generation failed");
      throw error;
    }
  }

  async ensureInvoiceForOrder(orderId: string): Promise<InvoiceDetailRecord | null> {
    const existing = await this.invoiceRepo.findByOrderId(orderId);
    if (existing) {
      return existing;
    }

    try {
      return await this.generateForOrder(orderId);
    } catch (error) {
      if (error instanceof ValidationError) {
        return null;
      }
      throw error;
    }
  }
}
