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
  pendingSettlementsNet: string;
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
  pendingSettlements: {
    orderCount: number;
    grossAmount: string;
    commissionAmount: string;
    netAmount: string;
  };
  completedSettlements: {
    batchCount: number;
    grossAmount: string;
    commissionAmount: string;
    netAmount: string;
  };
  commissionBySeller: CommissionBySellerDto[];
  period: AnalyticsPeriodDto | null;
}
