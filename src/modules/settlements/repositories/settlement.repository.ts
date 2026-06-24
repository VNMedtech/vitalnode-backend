import {
  OrderStatus,
  Prisma,
  SettlementBatchStatus,
  type PrismaClient,
} from "../../../../generated/prisma/client.js";
import { PENDING_SETTLEMENT_ORDER_STATUS } from "../../../shared/constants/orderSettlement.constants.js";
import type { SettlementSortField } from "../constants/settlement.constants.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

const settlementOrderSelect = {
  id: true,
  orderNumber: true,
  orderStatus: true,
  grossAmount: true,
  commissionAmount: true,
  sellerReceivableAmount: true,
  deliveredAt: true,
} satisfies Prisma.OrderSelect;

const settlementBatchListSelect = {
  id: true,
  sellerId: true,
  batchNumber: true,
  status: true,
  grossAmount: true,
  commissionAmount: true,
  netAmount: true,
  paymentReference: true,
  remarks: true,
  disbursedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      orders: true,
    },
  },
} satisfies Prisma.SettlementBatchSelect;

const settlementBatchDetailSelect = {
  ...settlementBatchListSelect,
  seller: {
    select: {
      id: true,
      businessName: true,
      commissionPercentage: true,
    },
  },
  orders: {
    select: settlementOrderSelect,
    orderBy: {
      deliveredAt: "asc" as const,
    },
  },
} satisfies Prisma.SettlementBatchSelect;

export type SettlementOrderRecord = Prisma.OrderGetPayload<{
  select: typeof settlementOrderSelect;
}>;

export type SettlementBatchListRecord = Prisma.SettlementBatchGetPayload<{
  select: typeof settlementBatchListSelect;
}>;

export type SettlementBatchDetailRecord = Prisma.SettlementBatchGetPayload<{
  select: typeof settlementBatchDetailSelect;
}>;

export interface FindSettlementBatchesOptions {
  page: number;
  limit: number;
  sortBy: SettlementSortField;
  sortOrder: "asc" | "desc";
  sellerId?: string;
  status?: SettlementBatchStatus;
  from?: Date;
  to?: Date;
}

function buildSettlementWhere(
  options: Pick<
    FindSettlementBatchesOptions,
    "sellerId" | "status" | "from" | "to"
  >,
): Prisma.SettlementBatchWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (options.from) {
    createdAt.gte = options.from;
  }
  if (options.to) {
    createdAt.lte = options.to;
  }

  return {
    ...(options.sellerId ? { sellerId: options.sellerId } : {}),
    ...(options.status ? { status: options.status } : {}),
    ...(options.from || options.to ? { createdAt } : {}),
  };
}

export class SettlementRepository {
  constructor(private readonly prisma: DbClient) {}

  findPendingOrdersBySellerId(sellerId: string) {
    return this.prisma.order.findMany({
      where: {
        sellerId,
        orderStatus: PENDING_SETTLEMENT_ORDER_STATUS,
        settlementBatchId: null,
      },
      select: settlementOrderSelect,
      orderBy: { deliveredAt: "asc" },
    });
  }

  findPendingOrdersByIds(orderIds: string[]) {
    return this.prisma.order.findMany({
      where: {
        id: { in: orderIds },
      },
      select: {
        ...settlementOrderSelect,
        sellerId: true,
        orderStatus: true,
        settlementBatchId: true,
      },
    });
  }

  async aggregatePendingBySeller(): Promise<
    Array<{
      sellerId: string;
      businessName: string;
      commissionPercentage: Prisma.Decimal | null;
      pendingOrderCount: number;
      grossAmount: Prisma.Decimal;
      commissionAmount: Prisma.Decimal;
      netAmount: Prisma.Decimal;
    }>
  > {
    const rows = await this.prisma.order.groupBy({
      by: ["sellerId"],
      where: {
        orderStatus: PENDING_SETTLEMENT_ORDER_STATUS,
        settlementBatchId: null,
      },
      _count: { _all: true },
      _sum: {
        grossAmount: true,
        commissionAmount: true,
        sellerReceivableAmount: true,
      },
    });

    if (rows.length === 0) {
      return [];
    }

    const sellers = await this.prisma.sellerProfile.findMany({
      where: {
        id: { in: rows.map((row) => row.sellerId) },
      },
      select: {
        id: true,
        businessName: true,
        commissionPercentage: true,
      },
    });

    const sellerMap = new Map(sellers.map((seller) => [seller.id, seller]));

    return rows.map((row) => {
      const seller = sellerMap.get(row.sellerId);
      return {
        sellerId: row.sellerId,
        businessName: seller?.businessName ?? "Unknown",
        commissionPercentage: seller?.commissionPercentage ?? null,
        pendingOrderCount: row._count._all,
        grossAmount: row._sum.grossAmount ?? new Prisma.Decimal(0),
        commissionAmount: row._sum.commissionAmount ?? new Prisma.Decimal(0),
        netAmount:
          row._sum.sellerReceivableAmount ?? new Prisma.Decimal(0),
      };
    });
  }

  countSettlementBatches(
    options: Pick<
      FindSettlementBatchesOptions,
      "sellerId" | "status" | "from" | "to"
    >,
  ) {
    return this.prisma.settlementBatch.count({
      where: buildSettlementWhere(options),
    });
  }

  findSettlementBatchesPaginated(options: FindSettlementBatchesOptions) {
    const { page, limit, sortBy, sortOrder } = options;
    const skip = (page - 1) * limit;

    return this.prisma.settlementBatch.findMany({
      where: buildSettlementWhere(options),
      select: settlementBatchListSelect,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    });
  }

  findSettlementBatchById(id: string) {
    return this.prisma.settlementBatch.findUnique({
      where: { id },
      select: settlementBatchDetailSelect,
    });
  }

  findSettlementBatchByIdForSeller(id: string, sellerId: string) {
    return this.prisma.settlementBatch.findFirst({
      where: { id, sellerId },
      select: settlementBatchDetailSelect,
    });
  }

  countBatchesForSeller(sellerId: string) {
    return this.prisma.settlementBatch.count({
      where: { sellerId },
    });
  }

  findBatchesForSellerPaginated(
    sellerId: string,
    page: number,
    limit: number,
    sortBy: SettlementSortField,
    sortOrder: "asc" | "desc",
  ) {
    const skip = (page - 1) * limit;
    return this.prisma.settlementBatch.findMany({
      where: { sellerId },
      select: settlementBatchListSelect,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    });
  }

  async getNextBatchSequence(): Promise<number> {
    const count = await this.prisma.settlementBatch.count();
    return count + 1;
  }

  createSettlementBatch(data: {
    sellerId: string;
    batchNumber: string;
    grossAmount: Prisma.Decimal;
    commissionAmount: Prisma.Decimal;
    netAmount: Prisma.Decimal;
    remarks?: string;
    createdByAdminId: string;
  }) {
    return this.prisma.settlementBatch.create({
      data: {
        sellerId: data.sellerId,
        batchNumber: data.batchNumber,
        status: SettlementBatchStatus.PENDING,
        grossAmount: data.grossAmount,
        commissionAmount: data.commissionAmount,
        netAmount: data.netAmount,
        remarks: data.remarks,
        createdByAdminId: data.createdByAdminId,
      },
      select: settlementBatchDetailSelect,
    });
  }

  linkOrdersToBatch(orderIds: string[], settlementBatchId: string) {
    return this.prisma.order.updateMany({
      where: {
        id: { in: orderIds },
        orderStatus: PENDING_SETTLEMENT_ORDER_STATUS,
        settlementBatchId: null,
      },
      data: { settlementBatchId },
    });
  }

  markBatchDisbursed(
    batchId: string,
    input: {
      paymentReference: string;
      remarks?: string;
      disbursedAt: Date;
    },
  ) {
    return this.prisma.settlementBatch.update({
      where: { id: batchId },
      data: {
        status: SettlementBatchStatus.DISBURSED,
        paymentReference: input.paymentReference,
        remarks: input.remarks,
        disbursedAt: input.disbursedAt,
      },
      select: settlementBatchDetailSelect,
    });
  }

  markOrdersSettled(batchId: string) {
    return this.prisma.order.updateMany({
      where: {
        settlementBatchId: batchId,
        orderStatus: PENDING_SETTLEMENT_ORDER_STATUS,
      },
      data: {
        orderStatus: OrderStatus.SETTLED,
      },
    });
  }

  lockBatchById(batchId: string) {
    return this.prisma.settlementBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        sellerId: true,
        status: true,
        batchNumber: true,
        seller: {
          select: {
            userId: true,
            businessName: true,
          },
        },
        orders: {
          select: {
            id: true,
            orderStatus: true,
          },
        },
      },
    });
  }

  async getSellerEarningsSummary(sellerId: string) {
    const [pendingAgg, completedAgg, completedBatchCount, settledAgg] =
      await Promise.all([
        this.prisma.order.aggregate({
          where: {
            sellerId,
            orderStatus: PENDING_SETTLEMENT_ORDER_STATUS,
            settlementBatchId: null,
          },
          _count: { _all: true },
          _sum: {
            grossAmount: true,
            commissionAmount: true,
            sellerReceivableAmount: true,
          },
        }),
        this.prisma.settlementBatch.aggregate({
          where: {
            sellerId,
            status: SettlementBatchStatus.DISBURSED,
          },
          _sum: {
            grossAmount: true,
            commissionAmount: true,
            netAmount: true,
          },
        }),
        this.prisma.settlementBatch.count({
          where: {
            sellerId,
            status: SettlementBatchStatus.DISBURSED,
          },
        }),
        this.prisma.order.aggregate({
          where: {
            sellerId,
            orderStatus: OrderStatus.SETTLED,
          },
          _sum: {
            grossAmount: true,
            commissionAmount: true,
            sellerReceivableAmount: true,
          },
        }),
      ]);

    const pendingGross = pendingAgg._sum.grossAmount ?? new Prisma.Decimal(0);
    const pendingCommission =
      pendingAgg._sum.commissionAmount ?? new Prisma.Decimal(0);
    const pendingNet =
      pendingAgg._sum.sellerReceivableAmount ?? new Prisma.Decimal(0);

    const completedGross =
      completedAgg._sum.grossAmount ?? new Prisma.Decimal(0);
    const completedCommission =
      completedAgg._sum.commissionAmount ?? new Prisma.Decimal(0);
    const completedNet = completedAgg._sum.netAmount ?? new Prisma.Decimal(0);

    const settledGross = settledAgg._sum.grossAmount ?? new Prisma.Decimal(0);
    const settledCommission =
      settledAgg._sum.commissionAmount ?? new Prisma.Decimal(0);
    const settledNet =
      settledAgg._sum.sellerReceivableAmount ?? new Prisma.Decimal(0);

    return {
      grossRevenue: pendingGross.add(settledGross),
      commissionPaid: pendingCommission.add(settledCommission),
      netEarnings: pendingNet.add(settledNet),
      pendingOrderCount: pendingAgg._count._all,
      pendingGross,
      pendingCommission,
      pendingNet,
      completedBatchCount,
      completedGross,
      completedCommission,
      completedNet,
    };
  }
}
