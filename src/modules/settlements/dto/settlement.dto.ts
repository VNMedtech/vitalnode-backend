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
    seller: {
      id: record.seller.id,
      businessName: record.seller.businessName,
    },
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
    grossSales: Prisma.Decimal;
    commission: Prisma.Decimal;
    lifetimeNet: Prisma.Decimal;
    earnedOrderCount: number;
    earnedGross: Prisma.Decimal;
    earnedCommission: Prisma.Decimal;
    earnedNet: Prisma.Decimal;
    paidOutOrderCount: number;
    paidOutBatchCount: number;
    paidOutGross: Prisma.Decimal;
    paidOutCommission: Prisma.Decimal;
    paidOutNet: Prisma.Decimal;
  },
): SellerEarningsSummaryDto {
  return {
    grossSales: decimalToString(summary.grossSales),
    commission: decimalToString(summary.commission),
    lifetimeNet: decimalToString(summary.lifetimeNet),
    earnedReceivable: {
      orderCount: summary.earnedOrderCount,
      grossAmount: decimalToString(summary.earnedGross),
      commissionAmount: decimalToString(summary.earnedCommission),
      netAmount: decimalToString(summary.earnedNet),
    },
    paidOut: {
      orderCount: summary.paidOutOrderCount,
      batchCount: summary.paidOutBatchCount,
      grossAmount: decimalToString(summary.paidOutGross),
      commissionAmount: decimalToString(summary.paidOutCommission),
      netAmount: decimalToString(summary.paidOutNet),
    },
  };
}
