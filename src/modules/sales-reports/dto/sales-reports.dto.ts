import { Prisma } from "../../../../generated/prisma/client.js";
import { toAnalyticsPeriodDto } from "../../analytics/dto/analytics.dto.js";
import type {
  PlatformSalesReportDto,
  SellerOrdersSummaryDto,
  SellerRevenueSummaryDto,
  SellerSalesReportItemDto,
  SellerSalesSummaryDto,
  TopProductDto,
} from "../types/sales-reports.types.js";
import type {
  PlatformSalesRecord,
  RevenueBucketRecord,
  SellerOrderMetricsRecord,
  SellerRevenueMetricsRecord,
  SellerSalesReportRecord,
  TopProductRecord,
} from "../repositories/sales-reports.repository.js";

function decimalToString(value: Prisma.Decimal | null | undefined): string {
  if (value === null || value === undefined) {
    return "0.00";
  }
  return value.toString();
}

function toTopProductDto(record: TopProductRecord): TopProductDto {
  return {
    productId: record.productId,
    productName: record.productName,
    totalQuantity: Number(record.totalQuantity),
    revenue: decimalToString(record.revenue),
    orderCount: Number(record.orderCount),
  };
}

function toRevenueBucketDto(record: RevenueBucketRecord) {
  return {
    periodStart: record.periodStart.toISOString(),
    revenue: decimalToString(record.revenue),
    paymentCount: record.paymentCount,
  };
}

export function toSellerSalesSummaryDto(
  orderMetrics: SellerOrderMetricsRecord,
  revenueMetrics: SellerRevenueMetricsRecord,
  topProducts: TopProductRecord[],
  from?: Date,
  to?: Date,
): SellerSalesSummaryDto {
  return {
    totalOrders: orderMetrics.totalOrders,
    completedOrders: orderMetrics.completedOrders,
    cancelledOrders: orderMetrics.cancelledOrders,
    revenue: decimalToString(revenueMetrics.revenueInPeriod),
    topProducts: topProducts.map(toTopProductDto),
    period: toAnalyticsPeriodDto(from, to),
  };
}

export function toSellerOrdersSummaryDto(
  record: SellerOrderMetricsRecord,
  from?: Date,
  to?: Date,
): SellerOrdersSummaryDto {
  return {
    totalOrders: record.totalOrders,
    completedOrders: record.completedOrders,
    cancelledOrders: record.cancelledOrders,
    ordersInPeriod: record.ordersInPeriod,
    byStatus: record.byStatus,
    period: toAnalyticsPeriodDto(from, to),
  };
}

export function toSellerRevenueSummaryDto(
  record: SellerRevenueMetricsRecord,
  buckets: RevenueBucketRecord[],
  from?: Date,
  to?: Date,
): SellerRevenueSummaryDto {
  return {
    totalRevenue: decimalToString(record.totalRevenue),
    revenueInPeriod: decimalToString(record.revenueInPeriod),
    successfulPayments: record.successfulPayments,
    buckets: buckets.map(toRevenueBucketDto),
    period: toAnalyticsPeriodDto(from, to),
  };
}

export function toPlatformSalesReportDto(
  record: PlatformSalesRecord,
  from?: Date,
  to?: Date,
): PlatformSalesReportDto {
  return {
    totalRevenue: decimalToString(record.totalRevenue),
    sellerRevenue: decimalToString(record.sellerRevenue),
    orderVolume: record.orderVolume,
    productVolume: record.productVolume,
    period: toAnalyticsPeriodDto(from, to),
  };
}

export function toSellerSalesReportItemDto(
  record: SellerSalesReportRecord,
): SellerSalesReportItemDto {
  return {
    sellerId: record.sellerId,
    businessName: record.businessName,
    totalRevenue: decimalToString(record.totalRevenue),
    orderVolume: Number(record.orderVolume),
    productVolume: Number(record.productVolume),
  };
}
