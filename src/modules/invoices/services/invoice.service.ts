/**
 * @read-only
 * @idempotent: yes
 * @external-calls: AWS S3 signed URL
 */
import { generateSignedDownloadUrl } from "../../../infrastructure/s3/index.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ForbiddenError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { BuyerRepository } from "../../buyers/repositories/buyer.repository.js";
import {
  toInvoiceDetailDto,
  toInvoiceSummaryDto,
} from "../dto/invoice.dto.js";
import type { InvoiceDetailRecord } from "../repositories/invoice.repository.js";
import { InvoiceRepository } from "../repositories/invoice.repository.js";
import type {
  InvoiceDetailDto,
  InvoiceSummaryDto,
  ListInvoicesQuery,
} from "../types/invoice.types.js";
import { InvoiceGenerationService } from "./invoiceGeneration.service.js";
import { buildInvoiceS3Key } from "./invoicePdf.service.js";

export class InvoiceService {
  private readonly invoiceRepo = new InvoiceRepository(prisma);
  private readonly buyerRepo = new BuyerRepository(prisma);
  private readonly generationService = new InvoiceGenerationService();

  private async resolveDownloadUrl(invoiceNumber: string): Promise<string> {
    return generateSignedDownloadUrl(buildInvoiceS3Key(invoiceNumber));
  }

  private async mapSummary(
    record: InvoiceDetailRecord,
  ): Promise<InvoiceSummaryDto> {
    const downloadUrl = await this.resolveDownloadUrl(record.invoiceNumber);
    return toInvoiceSummaryDto(record, downloadUrl);
  }

  private async mapDetail(record: InvoiceDetailRecord): Promise<InvoiceDetailDto> {
    const downloadUrl = await this.resolveDownloadUrl(record.invoiceNumber);
    return toInvoiceDetailDto(record, downloadUrl);
  }

  private async resolveBuyerId(actorUserId: string): Promise<string> {
    const buyer = await this.buyerRepo.findIdByUserId(actorUserId);
    if (!buyer) {
      throw new ForbiddenError("Buyer profile required");
    }
    return buyer.id;
  }

  async listBuyerInvoices(
    actorUserId: string,
    query: ListInvoicesQuery,
  ): Promise<{
    items: InvoiceSummaryDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    const filters = { ...query, buyerId };

    const [records, total] = await Promise.all([
      this.invoiceRepo.findMany(filters),
      this.invoiceRepo.count(filters),
    ]);

    const items = await Promise.all(records.map((record) => this.mapSummary(record)));

    return {
      items,
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getBuyerInvoiceById(
    actorUserId: string,
    invoiceId: string,
  ): Promise<InvoiceDetailDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    const invoice = await this.invoiceRepo.findById(invoiceId);

    if (!invoice || invoice.buyerId !== buyerId) {
      throw new NotFoundError("Invoice not found");
    }

    return this.mapDetail(invoice);
  }

  async getBuyerInvoiceByOrderId(
    actorUserId: string,
    orderId: string,
  ): Promise<InvoiceDetailDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { buyerId: true },
    });

    if (!order || order.buyerId !== buyerId) {
      throw new NotFoundError("Order not found");
    }

    let invoice = await this.invoiceRepo.findByOrderId(orderId);
    if (!invoice) {
      invoice = await this.generationService.generateForOrder(orderId, actorUserId);
    }

    return this.mapDetail(invoice);
  }

  async listAdminInvoices(
    query: ListInvoicesQuery,
  ): Promise<{
    items: InvoiceSummaryDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const [records, total] = await Promise.all([
      this.invoiceRepo.findMany(query),
      this.invoiceRepo.count(query),
    ]);

    const items = await Promise.all(records.map((record) => this.mapSummary(record)));

    return {
      items,
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getAdminInvoiceById(invoiceId: string): Promise<InvoiceDetailDto> {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundError("Invoice not found");
    }

    return this.mapDetail(invoice);
  }
}
