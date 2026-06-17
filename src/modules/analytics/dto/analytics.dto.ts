import { Prisma } from "../../../../generated/prisma/client.js";
import type {
  AnalyticsPeriodDto,
  DashboardSummaryDto,
  OrderStatisticsDto,
  ProductStatisticsDto,
  RevenuePeriodBucketDto,
  RevenueStatisticsDto,
  SellerStatisticsDto,
  UserStatisticsDto,
} from "../types/analytics.types.js";
import type {
  DashboardSummaryRecord,
  OrderStatisticsRecord,
  ProductStatisticsRecord,
  RevenueBucketRecord,
  RevenueStatisticsRecord,
  SellerStatisticsRecord,
  UserStatisticsRecord,
} from "../repositories/analytics.repository.js";

function decimalToString(value: Prisma.Decimal | null | undefined): string {
  if (value === null || value === undefined) {
    return "0.00";
  }
  return value.toString();
}

export function toAnalyticsPeriodDto(
  from?: Date,
  to?: Date,
): AnalyticsPeriodDto | null {
  if (!from && !to) {
    return null;
  }

  return {
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
  };
}

export function toDashboardSummaryDto(
  record: DashboardSummaryRecord,
): DashboardSummaryDto {
  return {
    totalUsers: record.totalUsers,
    totalBuyers: record.totalBuyers,
    totalSellers: record.totalSellers,
    totalProducts: record.totalProducts,
    pendingProducts: record.pendingProducts,
    totalOrders: record.totalOrders,
    totalRevenue: decimalToString(record.totalRevenue),
    lowStockProducts: record.lowStockProducts,
    generatedAt: new Date().toISOString(),
  };
}

export function toUserStatisticsDto(
  record: UserStatisticsRecord,
  from?: Date,
  to?: Date,
): UserStatisticsDto {
  return {
    totalUsers: record.totalUsers,
    activeUsers: record.activeUsers,
    disabledUsers: record.disabledUsers,
    byRole: {
      admin: record.byRole.admin,
      buyer: record.byRole.buyer,
      seller: record.byRole.seller,
      deliveryPartner: record.byRole.deliveryPartner,
    },
    newUsers: record.newUsers,
    period: toAnalyticsPeriodDto(from, to),
  };
}

export function toSellerStatisticsDto(
  record: SellerStatisticsRecord,
  from?: Date,
  to?: Date,
): SellerStatisticsDto {
  return {
    totalSellers: record.totalSellers,
    byApprovalStatus: {
      pendingApproval: record.byApprovalStatus.pendingApproval,
      active: record.byApprovalStatus.active,
      rejected: record.byApprovalStatus.rejected,
      disabled: record.byApprovalStatus.disabled,
    },
    newSellers: record.newSellers,
    period: toAnalyticsPeriodDto(from, to),
  };
}

export function toProductStatisticsDto(
  record: ProductStatisticsRecord,
  from?: Date,
  to?: Date,
): ProductStatisticsDto {
  return {
    totalProducts: record.totalProducts,
    pendingProducts: record.pendingProducts,
    byStatus: {
      pendingApproval: record.byStatus.pendingApproval,
      approved: record.byStatus.approved,
      rejected: record.byStatus.rejected,
      disabled: record.byStatus.disabled,
      outOfStock: record.byStatus.outOfStock,
    },
    newProducts: record.newProducts,
    period: toAnalyticsPeriodDto(from, to),
  };
}

export function toOrderStatisticsDto(
  record: OrderStatisticsRecord,
  from?: Date,
  to?: Date,
): OrderStatisticsDto {
  return {
    totalOrders: record.totalOrders,
    placedOrders: record.placedOrders,
    averageOrderValue: decimalToString(record.averageOrderValue),
    byStatus: record.byStatus,
    ordersInPeriod: record.ordersInPeriod,
    period: toAnalyticsPeriodDto(from, to),
  };
}

export function toRevenueBucketDto(
  record: RevenueBucketRecord,
): RevenuePeriodBucketDto {
  return {
    periodStart: record.periodStart.toISOString(),
    revenue: decimalToString(record.revenue),
    paymentCount: record.paymentCount,
  };
}

export function toRevenueStatisticsDto(
  record: RevenueStatisticsRecord,
  buckets: RevenueBucketRecord[],
  from?: Date,
  to?: Date,
): RevenueStatisticsDto {
  return {
    totalRevenue: decimalToString(record.totalRevenue),
    revenueInPeriod: decimalToString(record.revenueInPeriod),
    successfulPayments: record.successfulPayments,
    failedPayments: record.failedPayments,
    pendingPayments: record.pendingPayments,
    buckets: buckets.map(toRevenueBucketDto),
    period: toAnalyticsPeriodDto(from, to),
  };
}
