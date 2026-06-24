/**
 * @transaction-owner
 * @idempotent: no
 * @external-calls: notifications
 */
import { Prisma, SettlementBatchStatus } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import { PENDING_SETTLEMENT_ORDER_STATUS } from "../../../shared/constants/orderSettlement.constants.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { runInTransaction } from "../../../shared/transactions/runInTransaction.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import { notificationDispatcher } from "../../notifications/index.js";
import { SellerRepository } from "../../sellers/repositories/seller.repository.js";
import {
  SETTLEMENT_ACTIONS,
  SETTLEMENT_AUDIT_ENTITY_TYPE,
  SETTLEMENT_BATCH_NUMBER_PREFIX,
  SETTLEMENT_NOTIFICATION_EVENTS,
  SETTLEMENT_NOTIFICATION_TYPES,
} from "../constants/settlement.constants.js";
import {
  toPendingSettlementSellerDto,
  toSellerEarningsSummaryDto,
  toSellerPendingSettlementDetailDto,
  toSettlementBatchDetailDto,
  toSettlementBatchSummaryDto,
} from "../dto/settlement.dto.js";
import { SettlementRepository } from "../repositories/settlement.repository.js";
import type {
  CreateSettlementBatchInput,
  DisburseSettlementBatchInput,
  ListSettlementsQuery,
  PendingSettlementSellerDto,
  SellerEarningsSummaryDto,
  SellerPendingSettlementDetailDto,
  SettlementBatchDetailDto,
  SettlementBatchSummaryDto,
} from "../types/settlement.types.js";
import { calculateCommissionBreakdown, sumDecimal } from "../utils/commission.util.js";

function formatBatchNumber(sequence: number): string {
  const date = new Date();
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const seq = String(sequence).padStart(6, "0");
  return `${SETTLEMENT_BATCH_NUMBER_PREFIX}-${y}${m}${d}-${seq}`;
}

export class SettlementService {
  private readonly settlementRepo = new SettlementRepository(prisma);
  private readonly sellerRepo = new SellerRepository(prisma);

  async listPendingSettlements(): Promise<PendingSettlementSellerDto[]> {
    const rows = await this.settlementRepo.aggregatePendingBySeller();
    return rows.map(toPendingSettlementSellerDto);
  }

  async getSellerPendingSettlementDetail(
    sellerId: string,
  ): Promise<SellerPendingSettlementDetailDto> {
    const seller = await this.sellerRepo.findById(sellerId);
    if (!seller) {
      throw new NotFoundError("Seller not found");
    }

    const orders = await this.settlementRepo.findPendingOrdersBySellerId(
      sellerId,
    );

    const totals = {
      grossAmount: sumDecimal(
        orders.map((order) => order.grossAmount ?? new Prisma.Decimal(0)),
      ),
      commissionAmount: sumDecimal(
        orders.map((order) => order.commissionAmount ?? new Prisma.Decimal(0)),
      ),
      netAmount: sumDecimal(
        orders.map(
          (order) => order.sellerReceivableAmount ?? new Prisma.Decimal(0),
        ),
      ),
    };

    return toSellerPendingSettlementDetailDto(seller, orders, totals);
  }

  async listSettlementHistory(query: ListSettlementsQuery): Promise<{
    items: SettlementBatchSummaryDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const [items, total] = await Promise.all([
      this.settlementRepo.findSettlementBatchesPaginated(query),
      this.settlementRepo.countSettlementBatches(query),
    ]);

    return {
      items: items.map(toSettlementBatchSummaryDto),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getSettlementBatchById(
    batchId: string,
  ): Promise<SettlementBatchDetailDto> {
    const batch = await this.settlementRepo.findSettlementBatchById(batchId);
    if (!batch) {
      throw new NotFoundError("Settlement batch not found");
    }
    return toSettlementBatchDetailDto(batch);
  }

  async createSettlementBatch(
    actorUserId: string,
    input: CreateSettlementBatchInput,
  ): Promise<SettlementBatchDetailDto> {
    if (input.orderIds.length === 0) {
      throw new ValidationError("Validation failed", [
        { field: "orderIds", message: "At least one order is required" },
      ]);
    }

    const uniqueOrderIds = [...new Set(input.orderIds)];
    if (uniqueOrderIds.length !== input.orderIds.length) {
      throw new ValidationError("Validation failed", [
        { field: "orderIds", message: "Duplicate order IDs are not allowed" },
      ]);
    }

    const seller = await this.sellerRepo.findById(input.sellerId);
    if (!seller) {
      throw new NotFoundError("Seller not found");
    }

    const orders = await this.settlementRepo.findPendingOrdersByIds(
      uniqueOrderIds,
    );

    if (orders.length !== uniqueOrderIds.length) {
      throw new NotFoundError("One or more orders were not found");
    }

    const invalidOrders = orders.filter(
      (order) =>
        order.sellerId !== input.sellerId ||
        order.orderStatus !== PENDING_SETTLEMENT_ORDER_STATUS ||
        order.settlementBatchId !== null,
    );

    if (invalidOrders.length > 0) {
      throw new ConflictError(
        "All orders must belong to the seller, be delivered, pending settlement, and not already in a batch",
      );
    }

    const grossAmount = sumDecimal(
      orders.map((order) => order.grossAmount ?? new Prisma.Decimal(0)),
    );
    const commissionAmount = sumDecimal(
      orders.map((order) => order.commissionAmount ?? new Prisma.Decimal(0)),
    );
    const netAmount = sumDecimal(
      orders.map(
        (order) => order.sellerReceivableAmount ?? new Prisma.Decimal(0),
      ),
    );

    return runInTransaction(async (tx) => {
      const repo = new SettlementRepository(tx);
      const sequence = await repo.getNextBatchSequence();
      const batchNumber = formatBatchNumber(sequence);

      const batch = await repo.createSettlementBatch({
        sellerId: input.sellerId,
        batchNumber,
        grossAmount,
        commissionAmount,
        netAmount,
        remarks: input.remarks,
        createdByAdminId: actorUserId,
      });

      const linked = await repo.linkOrdersToBatch(uniqueOrderIds, batch.id);
      if (linked.count !== uniqueOrderIds.length) {
        throw new ConflictError(
          "One or more orders are no longer eligible for settlement",
        );
      }

      const detail = await repo.findSettlementBatchById(batch.id);
      if (!detail) {
        throw new NotFoundError("Settlement batch not found");
      }

      auditLogger.log({
        actorUserId,
        action: SETTLEMENT_ACTIONS.BATCH_CREATED,
        entityType: SETTLEMENT_AUDIT_ENTITY_TYPE,
        entityId: batch.id,
        metadata: {
          sellerId: input.sellerId,
          batchNumber,
          orderIds: uniqueOrderIds,
          grossAmount: grossAmount.toString(),
          commissionAmount: commissionAmount.toString(),
          netAmount: netAmount.toString(),
        },
      });

      notificationDispatcher.createInApp({
        userId: seller.userId,
        type: SETTLEMENT_NOTIFICATION_TYPES.BATCH_CREATED,
        title: "Settlement batch created",
        message: `Settlement batch ${batchNumber} has been created for ${seller.businessName} with net amount ${netAmount.toString()}.`,
      });

      return toSettlementBatchDetailDto(detail);
    });
  }

  async disburseSettlementBatch(
    actorUserId: string,
    batchId: string,
    input: DisburseSettlementBatchInput,
  ): Promise<SettlementBatchDetailDto> {
    return runInTransaction(async (tx) => {
      const repo = new SettlementRepository(tx);
      const locked = await repo.lockBatchById(batchId);

      if (!locked) {
        throw new NotFoundError("Settlement batch not found");
      }

      if (locked.status !== SettlementBatchStatus.PENDING) {
        throw new ConflictError("Settlement batch has already been disbursed");
      }

      const disbursedAt = new Date();
      const batch = await repo.markBatchDisbursed(batchId, {
        paymentReference: input.paymentReference,
        remarks: input.remarks,
        disbursedAt,
      });

      const updatedOrders = await repo.markOrdersSettled(batchId);
      if (updatedOrders.count !== locked.orders.length) {
        throw new ConflictError("Failed to mark all orders as settled");
      }

      auditLogger.log({
        actorUserId,
        action: SETTLEMENT_ACTIONS.BATCH_DISBURSED,
        entityType: SETTLEMENT_AUDIT_ENTITY_TYPE,
        entityId: batchId,
        metadata: {
          batchNumber: locked.batchNumber,
          paymentReference: input.paymentReference,
          orderCount: locked.orders.length,
        },
      });

      notificationDispatcher.emit({
        eventType: SETTLEMENT_NOTIFICATION_EVENTS.BATCH_DISBURSED,
        correlationId: batchId,
        inApp: {
          userId: locked.seller.userId,
          type: SETTLEMENT_NOTIFICATION_TYPES.BATCH_DISBURSED,
          title: "Settlement disbursed",
          message: `Settlement batch ${locked.batchNumber} has been disbursed. Payment reference: ${input.paymentReference}.`,
        },
      });

      return toSettlementBatchDetailDto(batch);
    });
  }

  private async resolveSellerId(actorUserId: string): Promise<string> {
    const seller = await this.sellerRepo.findIdByUserId(actorUserId);
    if (!seller) {
      throw new ForbiddenError("Seller profile required");
    }
    return seller.id;
  }

  async getSellerEarningsSummary(
    actorUserId: string,
  ): Promise<SellerEarningsSummaryDto> {
    const sellerId = await this.resolveSellerId(actorUserId);
    const summary = await this.settlementRepo.getSellerEarningsSummary(sellerId);
    return toSellerEarningsSummaryDto(summary);
  }

  async listSellerSettlements(
    actorUserId: string,
    query: ListSettlementsQuery,
  ): Promise<{
    items: SettlementBatchSummaryDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const sellerId = await this.resolveSellerId(actorUserId);
    const [items, total] = await Promise.all([
      this.settlementRepo.findBatchesForSellerPaginated(
        sellerId,
        query.page,
        query.limit,
        query.sortBy,
        query.sortOrder,
      ),
      this.settlementRepo.countBatchesForSeller(sellerId),
    ]);

    return {
      items: items.map(toSettlementBatchSummaryDto),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getSellerSettlementById(
    actorUserId: string,
    batchId: string,
  ): Promise<SettlementBatchDetailDto> {
    const sellerId = await this.resolveSellerId(actorUserId);
    const batch = await this.settlementRepo.findSettlementBatchByIdForSeller(
      batchId,
      sellerId,
    );
    if (!batch) {
      throw new NotFoundError("Settlement batch not found");
    }
    return toSettlementBatchDetailDto(batch);
  }
}

export { calculateCommissionBreakdown };
