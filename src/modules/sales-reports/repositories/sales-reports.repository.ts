import {
  OrderStatus,
  Prisma,
  type PaymentStatus,
  type PrismaClient,
} from "../../../../generated/prisma/client.js";
import { POST_DELIVERY_ORDER_STATUSES } from "../../../shared/constants/orderSettlement.constants.js";
import type { SalesReportsRevenueGroupBy } from "../constants/sales-reports.constants.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface SellerOrderMetricsRecord {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  ordersInPeriod: number;
  byStatus: Record<string, number>;
}

export interface SellerRevenueMetricsRecord {
  totalRevenue: Prisma.Decimal;
  revenueInPeriod: Prisma.Decimal;
  successfulPayments: number;
}

export interface TopProductRecord {
  productId: string;
  productName: string;
  totalQuantity: bigint;
  revenue: Prisma.Decimal;
  orderCount: bigint;
}

export interface RevenueBucketRecord {
  periodStart: Date;
  revenue: Prisma.Decimal;
  paymentCount: number;
}

export interface PlatformSalesRecord {
  totalRevenue: Prisma.Decimal;
  sellerRevenue: Prisma.Decimal;
  orderVolume: number;
  productVolume: number;
}

export interface SellerSalesReportRecord {
  sellerId: string;
  businessName: string;
  totalRevenue: Prisma.Decimal;
  orderVolume: bigint;
  productVolume: bigint;
}

const COMPLETED_ORDER_STATUSES: OrderStatus[] = [
  ...POST_DELIVERY_ORDER_STATUSES,
];

const CANCELLED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
];

function buildPlacedAtFilter(
  from?: Date,
  to?: Date,
): Prisma.DateTimeNullableFilter | undefined {
  if (!from && !to) {
    return undefined;
  }

  const filter: Prisma.DateTimeNullableFilter = { not: null };
  if (from) {
    filter.gte = from;
  }
  if (to) {
    filter.lte = to;
  }
  return filter;
}

function revenueGroupByTrunc(unit: SalesReportsRevenueGroupBy): string {
  switch (unit) {
    case "week":
      return "week";
    case "month":
      return "month";
    default:
      return "day";
  }
}

function buildSellerOrderWhere(
  sellerId: string,
  from?: Date,
  to?: Date,
): Prisma.OrderWhereInput {
  const placedAtFilter = buildPlacedAtFilter(from, to);
  return {
    sellerId,
    ...(placedAtFilter ? { placedAt: placedAtFilter } : {}),
  };
}

function buildSuccessfulPaymentWhere(
  sellerId?: string,
  from?: Date,
  to?: Date,
): Prisma.PaymentWhereInput {
  const placedAtFilter = buildPlacedAtFilter(from, to);

  return {
    paymentStatus: "SUCCESS" as PaymentStatus,
    order: {
      placedAt: { not: null },
      ...(sellerId ? { sellerId } : {}),
      ...(placedAtFilter ? { placedAt: placedAtFilter } : {}),
    },
  };
}

export class SalesReportsRepository {
  constructor(private readonly db: DbClient) {}

  async getSellerOrderMetrics(
    sellerId: string,
    from?: Date,
    to?: Date,
  ): Promise<SellerOrderMetricsRecord> {
    const periodWhere = buildSellerOrderWhere(sellerId, from, to);
    const hasPeriod = from !== undefined || to !== undefined;

    const [
      totalOrders,
      completedOrders,
      cancelledOrders,
      ordersInPeriod,
      statusGroups,
    ] = await Promise.all([
      this.db.order.count({ where: { sellerId } }),
      this.db.order.count({
        where: {
          sellerId,
          orderStatus: { in: COMPLETED_ORDER_STATUSES },
        },
      }),
      this.db.order.count({
        where: {
          sellerId,
          orderStatus: { in: CANCELLED_ORDER_STATUSES },
        },
      }),
      hasPeriod
        ? this.db.order.count({ where: periodWhere })
        : Promise.resolve(0),
      hasPeriod
        ? this.db.order.groupBy({
            by: ["orderStatus"],
            where: periodWhere,
            _count: { _all: true },
          })
        : this.db.order.groupBy({
            by: ["orderStatus"],
            where: { sellerId },
            _count: { _all: true },
          }),
    ]);

    const byStatus = statusGroups.reduce<Record<string, number>>((acc, row) => {
      acc[row.orderStatus] = row._count._all;
      return acc;
    }, {});

    return {
      totalOrders,
      completedOrders,
      cancelledOrders,
      ordersInPeriod: hasPeriod ? ordersInPeriod : totalOrders,
      byStatus,
    };
  }

  async getSellerRevenueMetrics(
    sellerId: string,
    from?: Date,
    to?: Date,
  ): Promise<SellerRevenueMetricsRecord> {
    const hasPeriod = from !== undefined || to !== undefined;
    const allTimeWhere = buildSuccessfulPaymentWhere(sellerId);
    const periodWhere = buildSuccessfulPaymentWhere(sellerId, from, to);

    const [totalAggregate, periodAggregate, successfulPayments] =
      await Promise.all([
        this.db.payment.aggregate({
          where: allTimeWhere,
          _sum: { amount: true },
        }),
        hasPeriod
          ? this.db.payment.aggregate({
              where: periodWhere,
              _sum: { amount: true },
            })
          : Promise.resolve({ _sum: { amount: null } }),
        hasPeriod
          ? this.db.payment.count({ where: periodWhere })
          : this.db.payment.count({ where: allTimeWhere }),
      ]);

    return {
      totalRevenue: totalAggregate._sum.amount ?? new Prisma.Decimal(0),
      revenueInPeriod: hasPeriod
        ? periodAggregate._sum.amount ?? new Prisma.Decimal(0)
        : totalAggregate._sum.amount ?? new Prisma.Decimal(0),
      successfulPayments,
    };
  }

  async getSellerTopProducts(
    sellerId: string,
    from: Date | undefined,
    to: Date | undefined,
    limit: number,
  ): Promise<TopProductRecord[]> {
    const fromDate = from ?? new Date(0);
    const toDate = to ?? new Date();

    return this.db.$queryRaw<TopProductRecord[]>`
      SELECT
        oi."productId",
        p."productName",
        COALESCE(SUM(oi.quantity), 0)::bigint AS "totalQuantity",
        COALESCE(SUM(oi."totalPrice"), 0) AS revenue,
        COUNT(DISTINCT oi."orderId")::bigint AS "orderCount"
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON o.id = oi."orderId"
      INNER JOIN "Payment" pay ON pay."orderId" = o.id
      INNER JOIN "Product" p ON p.id = oi."productId"
      WHERE o."sellerId" = ${sellerId}
        AND pay."paymentStatus" = 'SUCCESS'::"PaymentStatus"
        AND o."placedAt" IS NOT NULL
        AND o."placedAt" >= ${fromDate}
        AND o."placedAt" <= ${toDate}
      GROUP BY oi."productId", p."productName"
      ORDER BY revenue DESC, "totalQuantity" DESC
      LIMIT ${limit}
    `;
  }

  async getSellerRevenueBuckets(
    sellerId: string,
    groupBy: SalesReportsRevenueGroupBy,
    from?: Date,
    to?: Date,
  ): Promise<RevenueBucketRecord[]> {
    const truncUnit = revenueGroupByTrunc(groupBy);
    const fromDate = from ?? new Date(0);
    const toDate = to ?? new Date();

    const rows = await this.db.$queryRaw<
      Array<{
        periodStart: Date;
        revenue: Prisma.Decimal;
        paymentCount: bigint;
      }>
    >`
      SELECT
        DATE_TRUNC(${truncUnit}, pay."createdAt") AS "periodStart",
        COALESCE(SUM(pay.amount), 0) AS revenue,
        COUNT(*)::bigint AS "paymentCount"
      FROM "Payment" pay
      INNER JOIN "Order" o ON o.id = pay."orderId"
      WHERE pay."paymentStatus" = 'SUCCESS'::"PaymentStatus"
        AND o."sellerId" = ${sellerId}
        AND o."placedAt" IS NOT NULL
        AND pay."createdAt" >= ${fromDate}
        AND pay."createdAt" <= ${toDate}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return rows.map((row) => ({
      periodStart: row.periodStart,
      revenue: row.revenue,
      paymentCount: Number(row.paymentCount),
    }));
  }

  async getPlatformSalesMetrics(
    from?: Date,
    to?: Date,
  ): Promise<PlatformSalesRecord> {
    const hasPeriod = from !== undefined || to !== undefined;
    const allTimePaymentWhere: Prisma.PaymentWhereInput = {
      paymentStatus: "SUCCESS" as PaymentStatus,
      order: { placedAt: { not: null } },
    };
    const periodPaymentWhere = buildSuccessfulPaymentWhere(undefined, from, to);
    const placedAtFilter = buildPlacedAtFilter(from, to);

    const orderWhere: Prisma.OrderWhereInput | undefined = placedAtFilter
      ? { placedAt: placedAtFilter }
      : hasPeriod
        ? { placedAt: { not: null } }
        : undefined;

    const [
      totalRevenueAggregate,
      periodRevenueAggregate,
      orderVolume,
      productVolumeAggregate,
    ] = await Promise.all([
      this.db.payment.aggregate({
        where: allTimePaymentWhere,
        _sum: { amount: true },
      }),
      hasPeriod
        ? this.db.payment.aggregate({
            where: periodPaymentWhere,
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      orderWhere
        ? this.db.order.count({ where: orderWhere })
        : this.db.order.count({ where: { placedAt: { not: null } } }),
      orderWhere
        ? this.db.orderItem.aggregate({
            where: {
              order: orderWhere,
            },
            _sum: { quantity: true },
          })
        : this.db.orderItem.aggregate({
            where: {
              order: { placedAt: { not: null } },
            },
            _sum: { quantity: true },
          }),
    ]);

    const totalRevenue =
      totalRevenueAggregate._sum.amount ?? new Prisma.Decimal(0);
    const sellerRevenue = hasPeriod
      ? periodRevenueAggregate._sum.amount ?? new Prisma.Decimal(0)
      : totalRevenue;

    return {
      totalRevenue,
      sellerRevenue,
      orderVolume,
      productVolume: productVolumeAggregate._sum.quantity ?? 0,
    };
  }

  async findSellerSalesReportRows(options: {
    from?: Date;
    to?: Date;
    page: number;
    limit: number;
  }): Promise<SellerSalesReportRecord[]> {
    const { from, to, page, limit } = options;
    const skip = (page - 1) * limit;
    const fromDate = from ?? new Date(0);
    const toDate = to ?? new Date();
    const hasPeriod = from !== undefined || to !== undefined;

    if (!hasPeriod) {
      return this.db.$queryRaw<SellerSalesReportRecord[]>`
        SELECT
          sp.id AS "sellerId",
          sp."businessName",
          COALESCE(SUM(pay.amount), 0) AS "totalRevenue",
          COUNT(DISTINCT o.id) FILTER (WHERE o."placedAt" IS NOT NULL)::bigint AS "orderVolume",
          COALESCE(SUM(oi.quantity) FILTER (WHERE o."placedAt" IS NOT NULL), 0)::bigint AS "productVolume"
        FROM "SellerProfile" sp
        LEFT JOIN "Order" o ON o."sellerId" = sp.id
        LEFT JOIN "Payment" pay ON pay."orderId" = o.id
          AND pay."paymentStatus" = 'SUCCESS'::"PaymentStatus"
        LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
        GROUP BY sp.id, sp."businessName"
        ORDER BY "totalRevenue" DESC, sp."businessName" ASC
        LIMIT ${limit}
        OFFSET ${skip}
      `;
    }

    return this.db.$queryRaw<SellerSalesReportRecord[]>`
      SELECT
        sp.id AS "sellerId",
        sp."businessName",
        COALESCE(SUM(pay.amount), 0) AS "totalRevenue",
        COUNT(DISTINCT o.id)::bigint AS "orderVolume",
        COALESCE(SUM(oi.quantity), 0)::bigint AS "productVolume"
      FROM "SellerProfile" sp
      LEFT JOIN "Order" o ON o."sellerId" = sp.id
        AND o."placedAt" IS NOT NULL
        AND o."placedAt" >= ${fromDate}
        AND o."placedAt" <= ${toDate}
      LEFT JOIN "Payment" pay ON pay."orderId" = o.id
        AND pay."paymentStatus" = 'SUCCESS'::"PaymentStatus"
      LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
      GROUP BY sp.id, sp."businessName"
      ORDER BY "totalRevenue" DESC, sp."businessName" ASC
      LIMIT ${limit}
      OFFSET ${skip}
    `;
  }

  async countSellerSalesReportRows(): Promise<number> {
    const rows = await this.db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count FROM "SellerProfile"
    `;
    return Number(rows[0]?.count ?? 0);
  }
}
