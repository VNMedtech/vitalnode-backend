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
  seller: {
    id: string;
    businessName: string;
  };
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

/** Amounts for a settlement bucket (gross / commission / seller net). */
export interface SellerEarningsBucketDto {
  orderCount: number;
  grossAmount: string;
  commissionAmount: string;
  netAmount: string;
}

/**
 * Seller finance snapshot.
 *
 * - `earnedReceivable`: delivered, not yet disbursed (all `PENDING_SETTLEMENT`,
 *   whether unbatched or in a PENDING settlement batch).
 * - `paidOut`: actually disbursed (`SETTLED` / `DISBURSED` batches).
 * - Top-level totals are lifetime delivered = earned + paid out.
 */
export interface SellerEarningsSummaryDto {
  grossSales: string;
  commission: string;
  lifetimeNet: string;
  earnedReceivable: SellerEarningsBucketDto;
  paidOut: SellerEarningsBucketDto & { batchCount: number };
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
