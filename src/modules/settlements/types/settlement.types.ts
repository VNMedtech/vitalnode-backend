import type {
  Prisma,
  SettlementBatchStatus,
} from "../../../../generated/prisma/client.js";
import type { SettlementSortField } from "../constants/settlement.constants.js";

export interface SettlementOrderSummaryDto {
  id: string;
  orderNumber: string;
  orderStatus: string;
  grossAmount: string;
  commissionAmount: string;
  sellerReceivableAmount: string;
  deliveredAt: string | null;
}

export interface SettlementBatchSummaryDto {
  id: string;
  sellerId: string;
  batchNumber: string;
  status: SettlementBatchStatus;
  grossAmount: string;
  commissionAmount: string;
  netAmount: string;
  paymentReference: string | null;
  remarks: string | null;
  disbursedAt: string | null;
  createdAt: string;
  updatedAt: string;
  orderCount: number;
}

export interface SettlementBatchDetailDto extends SettlementBatchSummaryDto {
  orders: SettlementOrderSummaryDto[];
  seller: {
    id: string;
    businessName: string;
    commissionPercentage: string | null;
  };
}

export interface PendingSettlementSellerDto {
  sellerId: string;
  businessName: string;
  commissionPercentage: string | null;
  pendingOrderCount: number;
  grossAmount: string;
  commissionAmount: string;
  netAmount: string;
}

export interface SellerPendingSettlementDetailDto {
  sellerId: string;
  businessName: string;
  commissionPercentage: string | null;
  pendingOrders: SettlementOrderSummaryDto[];
  grossAmount: string;
  commissionAmount: string;
  netAmount: string;
}

export interface SellerEarningsSummaryDto {
  grossRevenue: string;
  commissionPaid: string;
  netEarnings: string;
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
}

export interface CreateSettlementBatchInput {
  sellerId: string;
  orderIds: string[];
  remarks?: string;
}

export interface DisburseSettlementBatchInput {
  paymentReference: string;
  remarks?: string;
}

export interface UpdateSellerCommissionInput {
  commissionPercentage: number;
}

export interface ApproveSellerWithCommissionInput {
  commissionPercentage: number;
}

export interface ListSettlementsQuery {
  page: number;
  limit: number;
  sortBy: SettlementSortField;
  sortOrder: "asc" | "desc";
  sellerId?: string;
  status?: SettlementBatchStatus;
  from?: Date;
  to?: Date;
}
