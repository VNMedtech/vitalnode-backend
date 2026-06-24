import type { Prisma } from "../../../../generated/prisma/client.js";
import type {
  SettlementBatchDetailRecord,
  SettlementBatchListRecord,
  SettlementOrderRecord,
} from "../repositories/settlement.repository.js";
import type {
  PendingSettlementSellerDto,
  SellerEarningsSummaryDto,
  SellerPendingSettlementDetailDto,
  SettlementBatchDetailDto,
  SettlementBatchSummaryDto,
  SettlementOrderSummaryDto,
} from "../types/settlement.types.js";

function decimalToString(value: Prisma.Decimal | null | undefined): string {
  return value?.toString() ?? "0.00";
}

export function toSettlementOrderSummaryDto(
  record: SettlementOrderRecord,
): SettlementOrderSummaryDto {
  return {
    id: record.id,
    orderNumber: record.orderNumber,
    orderStatus: record.orderStatus,
    grossAmount: decimalToString(record.grossAmount),
    commissionAmount: decimalToString(record.commissionAmount),
    sellerReceivableAmount: decimalToString(record.sellerReceivableAmount),
    deliveredAt: record.deliveredAt?.toISOString() ?? null,
  };
}

export function toSettlementBatchSummaryDto(
  record: SettlementBatchListRecord,
): SettlementBatchSummaryDto {
  return {
    id: record.id,
    sellerId: record.sellerId,
    batchNumber: record.batchNumber,
    status: record.status,
    grossAmount: decimalToString(record.grossAmount),
    commissionAmount: decimalToString(record.commissionAmount),
    netAmount: decimalToString(record.netAmount),
    paymentReference: record.paymentReference,
    remarks: record.remarks,
    disbursedAt: record.disbursedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    orderCount: record._count.orders,
  };
}

export function toSettlementBatchDetailDto(
  record: SettlementBatchDetailRecord,
): SettlementBatchDetailDto {
  return {
    ...toSettlementBatchSummaryDto(record),
    orderCount: record.orders.length,
    orders: record.orders.map(toSettlementOrderSummaryDto),
    seller: {
      id: record.seller.id,
      businessName: record.seller.businessName,
      commissionPercentage: decimalToString(record.seller.commissionPercentage),
    },
  };
}

export function toPendingSettlementSellerDto(
  record: {
    sellerId: string;
    businessName: string;
    commissionPercentage: Prisma.Decimal | null;
    pendingOrderCount: number;
    grossAmount: Prisma.Decimal;
    commissionAmount: Prisma.Decimal;
    netAmount: Prisma.Decimal;
  },
): PendingSettlementSellerDto {
  return {
    sellerId: record.sellerId,
    businessName: record.businessName,
    commissionPercentage: record.commissionPercentage?.toString() ?? null,
    pendingOrderCount: record.pendingOrderCount,
    grossAmount: decimalToString(record.grossAmount),
    commissionAmount: decimalToString(record.commissionAmount),
    netAmount: decimalToString(record.netAmount),
  };
}

export function toSellerPendingSettlementDetailDto(
  seller: {
    id: string;
    businessName: string;
    commissionPercentage: Prisma.Decimal | null;
  },
  orders: SettlementOrderRecord[],
  totals: {
    grossAmount: Prisma.Decimal;
    commissionAmount: Prisma.Decimal;
    netAmount: Prisma.Decimal;
  },
): SellerPendingSettlementDetailDto {
  return {
    sellerId: seller.id,
    businessName: seller.businessName,
    commissionPercentage: seller.commissionPercentage?.toString() ?? null,
    pendingOrders: orders.map(toSettlementOrderSummaryDto),
    grossAmount: decimalToString(totals.grossAmount),
    commissionAmount: decimalToString(totals.commissionAmount),
    netAmount: decimalToString(totals.netAmount),
  };
}

export function toSellerEarningsSummaryDto(
  summary: {
    grossRevenue: Prisma.Decimal;
    commissionPaid: Prisma.Decimal;
    netEarnings: Prisma.Decimal;
    pendingOrderCount: number;
    pendingGross: Prisma.Decimal;
    pendingCommission: Prisma.Decimal;
    pendingNet: Prisma.Decimal;
    completedBatchCount: number;
    completedGross: Prisma.Decimal;
    completedCommission: Prisma.Decimal;
    completedNet: Prisma.Decimal;
  },
): SellerEarningsSummaryDto {
  return {
    grossRevenue: decimalToString(summary.grossRevenue),
    commissionPaid: decimalToString(summary.commissionPaid),
    netEarnings: decimalToString(summary.netEarnings),
    pendingSettlements: {
      orderCount: summary.pendingOrderCount,
      grossAmount: decimalToString(summary.pendingGross),
      commissionAmount: decimalToString(summary.pendingCommission),
      netAmount: decimalToString(summary.pendingNet),
    },
    completedSettlements: {
      batchCount: summary.completedBatchCount,
      grossAmount: decimalToString(summary.completedGross),
      commissionAmount: decimalToString(summary.completedCommission),
      netAmount: decimalToString(summary.completedNet),
    },
  };
}
