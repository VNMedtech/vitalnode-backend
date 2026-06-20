import type { AnalyticsPeriodDto } from "../../analytics/types/analytics.types.js";

export interface TopProductDto {
  productId: string;
  productName: string;
  totalQuantity: number;
  revenue: string;
  orderCount: number;
}

export interface SellerSalesSummaryDto {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  revenue: string;
  topProducts: TopProductDto[];
  period: AnalyticsPeriodDto | null;
}

export interface SellerOrdersSummaryDto {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  ordersInPeriod: number;
  byStatus: Record<string, number>;
  period: AnalyticsPeriodDto | null;
}

export interface RevenuePeriodBucketDto {
  periodStart: string;
  revenue: string;
  paymentCount: number;
}

export interface SellerRevenueSummaryDto {
  totalRevenue: string;
  revenueInPeriod: string;
  successfulPayments: number;
  buckets: RevenuePeriodBucketDto[];
  period: AnalyticsPeriodDto | null;
}

export interface PlatformSalesReportDto {
  totalRevenue: string;
  sellerRevenue: string;
  orderVolume: number;
  productVolume: number;
  period: AnalyticsPeriodDto | null;
}

export interface SellerSalesReportItemDto {
  sellerId: string;
  businessName: string;
  totalRevenue: string;
  orderVolume: number;
  productVolume: number;
}
