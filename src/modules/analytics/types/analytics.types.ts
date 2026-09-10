export interface AnalyticsDateRangeQuery {
  from?: Date;
  to?: Date;
}

export interface DashboardSummaryDto {
  totalUsers: number;
  totalBuyers: number;
  totalSellers: number;
  totalProducts: number;
  pendingProducts: number;
  totalOrders: number;
  totalRevenue: string;
  totalPlatformCommission: string;
  /** Unbatched PENDING_SETTLEMENT order nets (ready to put in a batch). */
  pendingSettlementsNet: string;
  /** PENDING settlement batch nets (batched, not yet disbursed). */
  inBatchSettlementsNet: string;
  /** DISBURSED settlement batch nets. */
  completedSettlementsNet: string;
  lowStockProducts: number;
  generatedAt: string;
}

export interface UserStatisticsDto {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  byRole: {
    admin: number;
    buyer: number;
    seller: number;
    deliveryPartner: number;
  };
  newUsers: number;
  period: AnalyticsPeriodDto | null;
}

export interface SellerStatisticsDto {
  totalSellers: number;
  byApprovalStatus: {
    pendingApproval: number;
    active: number;
    rejected: number;
    disabled: number;
  };
  newSellers: number;
  period: AnalyticsPeriodDto | null;
}

export interface ProductStatisticsDto {
  totalProducts: number;
  pendingProducts: number;
  byStatus: {
    pendingApproval: number;
    approved: number;
    rejected: number;
    disabled: number;
    outOfStock: number;
  };
  newProducts: number;
  period: AnalyticsPeriodDto | null;
}

export interface OrderStatisticsDto {
  totalOrders: number;
  placedOrders: number;
  /** AVG(totalAmount) for placed orders with reportable paid payment (net of completed refunds). */
  averageOrderValue: string;
  byStatus: Record<string, number>;
  ordersInPeriod: number;
  period: AnalyticsPeriodDto | null;
}

export interface RevenuePeriodBucketDto {
  periodStart: string;
  revenue: string;
  paymentCount: number;
}

export interface RevenueStatisticsDto {
  totalRevenue: string;
  revenueInPeriod: string;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  buckets: RevenuePeriodBucketDto[];
  period: AnalyticsPeriodDto | null;
}

export interface AnalyticsPeriodDto {
  from: string | null;
  to: string | null;
}

export interface CommissionBySellerDto {
  sellerId: string;
  businessName: string;
  commissionAmount: string;
  orderCount: number;
}

export interface CommissionStatisticsDto {
  totalPlatformCommission: string;
  commissionInPeriod: string;
  /** Unbatched PENDING_SETTLEMENT orders (settlementBatchId IS NULL). */
  pendingSettlements: {
    orderCount: number;
    grossAmount: string;
    commissionAmount: string;
    netAmount: string;
  };
  /** PENDING settlement batches (created, not yet disbursed). */
  inBatchSettlements: {
    batchCount: number;
    grossAmount: string;
    commissionAmount: string;
    netAmount: string;
  };
  /** DISBURSED settlement batches. */
  completedSettlements: {
    batchCount: number;
    grossAmount: string;
    commissionAmount: string;
    netAmount: string;
  };
  commissionBySeller: CommissionBySellerDto[];
  period: AnalyticsPeriodDto | null;
}
