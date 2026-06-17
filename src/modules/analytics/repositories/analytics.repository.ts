import {
  Prisma,
  type PaymentStatus,
  type PrismaClient,
  type ProductStatus,
  type SellerApprovalStatus,
  type UserRole,
  type UserStatus,
} from "../../../../generated/prisma/client.js";
import { ProductStatus as ProductStatusEnum } from "../../../shared/enums/productStatus.enum.js";
import { UserRole as UserRoleEnum } from "../../../shared/enums/userRole.enum.js";
import { UserStatus as UserStatusEnum } from "../../../shared/enums/userStatus.enum.js";
import type {
  AnalyticsInventoryAlertFilter,
  AnalyticsRevenueGroupBy,
} from "../constants/analytics.constants.js";
import type { LowStockAlertRecord } from "../../inventory/dto/inventory.dto.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface DashboardSummaryRecord {
  totalUsers: number;
  totalBuyers: number;
  totalSellers: number;
  totalProducts: number;
  pendingProducts: number;
  totalOrders: number;
  totalRevenue: Prisma.Decimal;
  lowStockProducts: number;
}

export interface UserStatisticsRecord {
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
}

export interface SellerStatisticsRecord {
  totalSellers: number;
  byApprovalStatus: {
    pendingApproval: number;
    active: number;
    rejected: number;
    disabled: number;
  };
  newSellers: number;
}

export interface ProductStatisticsRecord {
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
}

export interface OrderStatisticsRecord {
  totalOrders: number;
  placedOrders: number;
  averageOrderValue: Prisma.Decimal;
  byStatus: Record<string, number>;
  ordersInPeriod: number;
}

export interface RevenueStatisticsRecord {
  totalRevenue: Prisma.Decimal;
  revenueInPeriod: Prisma.Decimal;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
}

export interface RevenueBucketRecord {
  periodStart: Date;
  revenue: Prisma.Decimal;
  paymentCount: number;
}

function buildCreatedAtFilter(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
  if (!from && !to) {
    return undefined;
  }

  const filter: Prisma.DateTimeFilter = {};
  if (from) {
    filter.gte = from;
  }
  if (to) {
    filter.lte = to;
  }
  return filter;
}

function buildPlacedAtFilter(from?: Date, to?: Date): Prisma.DateTimeNullableFilter | undefined {
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

function revenueGroupByTrunc(unit: AnalyticsRevenueGroupBy): string {
  switch (unit) {
    case "week":
      return "week";
    case "month":
      return "month";
    default:
      return "day";
  }
}

export class AnalyticsRepository {
  constructor(private readonly db: DbClient) {}

  private activeUserWhere: Prisma.UserWhereInput = {
    deletedAt: null,
  };

  private activeProductWhere: Prisma.ProductWhereInput = {
    deletedAt: null,
  };

  async getDashboardSummary(): Promise<DashboardSummaryRecord> {
    const [
      totalUsers,
      totalBuyers,
      totalSellers,
      totalProducts,
      pendingProducts,
      totalOrders,
      revenueAggregate,
      lowStockProducts,
    ] = await Promise.all([
      this.db.user.count({ where: this.activeUserWhere }),
      this.db.user.count({
        where: {
          ...this.activeUserWhere,
          role: UserRoleEnum.BUYER as UserRole,
        },
      }),
      this.db.user.count({
        where: {
          ...this.activeUserWhere,
          role: UserRoleEnum.SELLER as UserRole,
        },
      }),
      this.db.product.count({ where: this.activeProductWhere }),
      this.db.product.count({
        where: {
          ...this.activeProductWhere,
          status: ProductStatusEnum.PENDING_APPROVAL as ProductStatus,
        },
      }),
      this.db.order.count(),
      this.db.payment.aggregate({
        where: { paymentStatus: "SUCCESS" as PaymentStatus },
        _sum: { amount: true },
      }),
      this.countLowStockProducts(),
    ]);

    return {
      totalUsers,
      totalBuyers,
      totalSellers,
      totalProducts,
      pendingProducts,
      totalOrders,
      totalRevenue: revenueAggregate._sum.amount ?? new Prisma.Decimal(0),
      lowStockProducts,
    };
  }

  async getUserStatistics(from?: Date, to?: Date): Promise<UserStatisticsRecord> {
    const createdAtFilter = buildCreatedAtFilter(from, to);
    const newUsersWhere: Prisma.UserWhereInput = {
      ...this.activeUserWhere,
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    };

    const [
      totalUsers,
      activeUsers,
      disabledUsers,
      adminCount,
      buyerCount,
      sellerCount,
      deliveryPartnerCount,
      newUsers,
    ] = await Promise.all([
      this.db.user.count({ where: this.activeUserWhere }),
      this.db.user.count({
        where: {
          ...this.activeUserWhere,
          status: UserStatusEnum.ACTIVE as UserStatus,
        },
      }),
      this.db.user.count({
        where: {
          ...this.activeUserWhere,
          status: UserStatusEnum.DISABLED as UserStatus,
        },
      }),
      this.db.user.count({
        where: {
          ...this.activeUserWhere,
          role: UserRoleEnum.ADMIN as UserRole,
        },
      }),
      this.db.user.count({
        where: {
          ...this.activeUserWhere,
          role: UserRoleEnum.BUYER as UserRole,
        },
      }),
      this.db.user.count({
        where: {
          ...this.activeUserWhere,
          role: UserRoleEnum.SELLER as UserRole,
        },
      }),
      this.db.user.count({
        where: {
          ...this.activeUserWhere,
          role: UserRoleEnum.DELIVERY_PARTNER as UserRole,
        },
      }),
      createdAtFilter
        ? this.db.user.count({ where: newUsersWhere })
        : Promise.resolve(0),
    ]);

    return {
      totalUsers,
      activeUsers,
      disabledUsers,
      byRole: {
        admin: adminCount,
        buyer: buyerCount,
        seller: sellerCount,
        deliveryPartner: deliveryPartnerCount,
      },
      newUsers,
    };
  }

  async getSellerStatistics(
    from?: Date,
    to?: Date,
  ): Promise<SellerStatisticsRecord> {
    const createdAtFilter = buildCreatedAtFilter(from, to);

    const [
      totalSellers,
      pendingApproval,
      active,
      rejected,
      disabled,
      newSellers,
    ] = await Promise.all([
      this.db.sellerProfile.count(),
      this.db.sellerProfile.count({
        where: { approvalStatus: "PENDING_APPROVAL" as SellerApprovalStatus },
      }),
      this.db.sellerProfile.count({
        where: { approvalStatus: "ACTIVE" as SellerApprovalStatus },
      }),
      this.db.sellerProfile.count({
        where: { approvalStatus: "REJECTED" as SellerApprovalStatus },
      }),
      this.db.sellerProfile.count({
        where: { approvalStatus: "DISABLED" as SellerApprovalStatus },
      }),
      createdAtFilter
        ? this.db.sellerProfile.count({ where: { createdAt: createdAtFilter } })
        : Promise.resolve(0),
    ]);

    return {
      totalSellers,
      byApprovalStatus: {
        pendingApproval,
        active,
        rejected,
        disabled,
      },
      newSellers,
    };
  }

  async getProductStatistics(
    from?: Date,
    to?: Date,
  ): Promise<ProductStatisticsRecord> {
    const createdAtFilter = buildCreatedAtFilter(from, to);

    const [
      totalProducts,
      pendingProducts,
      pendingApproval,
      approved,
      rejected,
      disabled,
      outOfStock,
      newProducts,
    ] = await Promise.all([
      this.db.product.count({ where: this.activeProductWhere }),
      this.db.product.count({
        where: {
          ...this.activeProductWhere,
          status: ProductStatusEnum.PENDING_APPROVAL as ProductStatus,
        },
      }),
      this.db.product.count({
        where: {
          ...this.activeProductWhere,
          status: ProductStatusEnum.PENDING_APPROVAL as ProductStatus,
        },
      }),
      this.db.product.count({
        where: {
          ...this.activeProductWhere,
          status: ProductStatusEnum.APPROVED as ProductStatus,
        },
      }),
      this.db.product.count({
        where: {
          ...this.activeProductWhere,
          status: ProductStatusEnum.REJECTED as ProductStatus,
        },
      }),
      this.db.product.count({
        where: {
          ...this.activeProductWhere,
          status: ProductStatusEnum.DISABLED as ProductStatus,
        },
      }),
      this.db.product.count({
        where: {
          ...this.activeProductWhere,
          status: ProductStatusEnum.OUT_OF_STOCK as ProductStatus,
        },
      }),
      createdAtFilter
        ? this.db.product.count({
            where: {
              ...this.activeProductWhere,
              createdAt: createdAtFilter,
            },
          })
        : Promise.resolve(0),
    ]);

    return {
      totalProducts,
      pendingProducts,
      byStatus: {
        pendingApproval,
        approved,
        rejected,
        disabled,
        outOfStock,
      },
      newProducts,
    };
  }

  async getOrderStatistics(
    from?: Date,
    to?: Date,
  ): Promise<OrderStatisticsRecord> {
    const placedAtFilter = buildPlacedAtFilter(from, to);
    const periodWhere: Prisma.OrderWhereInput | undefined = placedAtFilter
      ? { placedAt: placedAtFilter }
      : undefined;

    const [totalOrders, placedOrders, averageAggregate, statusGroups, ordersInPeriod] =
      await Promise.all([
        this.db.order.count(),
        this.db.order.count({ where: { placedAt: { not: null } } }),
        this.db.order.aggregate({
          where: { placedAt: { not: null } },
          _avg: { totalAmount: true },
        }),
        this.db.order.groupBy({
          by: ["orderStatus"],
          _count: { _all: true },
        }),
        periodWhere
          ? this.db.order.count({ where: periodWhere })
          : Promise.resolve(0),
      ]);

    const byStatus = statusGroups.reduce<Record<string, number>>((acc, row) => {
      acc[row.orderStatus] = row._count._all;
      return acc;
    }, {});

    return {
      totalOrders,
      placedOrders,
      averageOrderValue:
        averageAggregate._avg.totalAmount ?? new Prisma.Decimal(0),
      byStatus,
      ordersInPeriod,
    };
  }

  async getRevenueStatistics(
    from?: Date,
    to?: Date,
  ): Promise<RevenueStatisticsRecord> {
    const createdAtFilter = buildCreatedAtFilter(from, to);
    const periodPaymentWhere: Prisma.PaymentWhereInput | undefined =
      createdAtFilter ? { createdAt: createdAtFilter } : undefined;

    const [
      totalRevenueAggregate,
      periodRevenueAggregate,
      successfulPayments,
      failedPayments,
      pendingPayments,
    ] = await Promise.all([
      this.db.payment.aggregate({
        where: { paymentStatus: "SUCCESS" as PaymentStatus },
        _sum: { amount: true },
      }),
      periodPaymentWhere
        ? this.db.payment.aggregate({
            where: {
              ...periodPaymentWhere,
              paymentStatus: "SUCCESS" as PaymentStatus,
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      this.db.payment.count({
        where: { paymentStatus: "SUCCESS" as PaymentStatus },
      }),
      this.db.payment.count({
        where: { paymentStatus: "FAILED" as PaymentStatus },
      }),
      this.db.payment.count({
        where: { paymentStatus: "PENDING" as PaymentStatus },
      }),
    ]);

    return {
      totalRevenue: totalRevenueAggregate._sum.amount ?? new Prisma.Decimal(0),
      revenueInPeriod:
        periodPaymentWhere && periodRevenueAggregate._sum.amount
          ? periodRevenueAggregate._sum.amount
          : periodPaymentWhere
            ? new Prisma.Decimal(0)
            : totalRevenueAggregate._sum.amount ?? new Prisma.Decimal(0),
      successfulPayments,
      failedPayments,
      pendingPayments,
    };
  }

  async getRevenueBuckets(
    groupBy: AnalyticsRevenueGroupBy,
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
        DATE_TRUNC(${truncUnit}, p."createdAt") AS "periodStart",
        COALESCE(SUM(p.amount), 0) AS revenue,
        COUNT(*)::bigint AS "paymentCount"
      FROM "Payment" p
      WHERE p."paymentStatus" = 'SUCCESS'::"PaymentStatus"
        AND p."createdAt" >= ${fromDate}
        AND p."createdAt" <= ${toDate}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return rows.map((row) => ({
      periodStart: row.periodStart,
      revenue: row.revenue,
      paymentCount: Number(row.paymentCount),
    }));
  }

  countLowStockProducts(): Promise<number> {
    return this.db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Product" p
      INNER JOIN "Inventory" i ON i."productId" = p.id
      WHERE p."deletedAt" IS NULL
        AND i."availableQuantity" <= p.moq
    `.then((rows) => Number(rows[0]?.count ?? 0));
  }

  findLowStockAlerts(options: {
    alertStatus: AnalyticsInventoryAlertFilter;
    page: number;
    limit: number;
  }): Promise<LowStockAlertRecord[]> {
    const { alertStatus, page, limit } = options;
    const skip = (page - 1) * limit;

    if (alertStatus === "ALL") {
      return this.db.$queryRaw<LowStockAlertRecord[]>`
        SELECT
          p.id AS "productId",
          p."productName",
          p.brand,
          p.model,
          p.moq,
          i."availableQuantity",
          p.status::text AS "productStatus",
          i."updatedAt"
        FROM "Product" p
        INNER JOIN "Inventory" i ON i."productId" = p.id
        WHERE p."deletedAt" IS NULL
          AND i."availableQuantity" <= p.moq
        ORDER BY i."availableQuantity" ASC, i."updatedAt" DESC
        LIMIT ${limit}
        OFFSET ${skip}
      `;
    }

    if (alertStatus === "OUT_OF_STOCK") {
      return this.db.$queryRaw<LowStockAlertRecord[]>`
        SELECT
          p.id AS "productId",
          p."productName",
          p.brand,
          p.model,
          p.moq,
          i."availableQuantity",
          p.status::text AS "productStatus",
          i."updatedAt"
        FROM "Product" p
        INNER JOIN "Inventory" i ON i."productId" = p.id
        WHERE p."deletedAt" IS NULL
          AND i."availableQuantity" = 0
        ORDER BY i."updatedAt" DESC
        LIMIT ${limit}
        OFFSET ${skip}
      `;
    }

    return this.db.$queryRaw<LowStockAlertRecord[]>`
      SELECT
        p.id AS "productId",
        p."productName",
        p.brand,
        p.model,
        p.moq,
        i."availableQuantity",
        p.status::text AS "productStatus",
        i."updatedAt"
      FROM "Product" p
      INNER JOIN "Inventory" i ON i."productId" = p.id
      WHERE p."deletedAt" IS NULL
        AND i."availableQuantity" > 0
        AND i."availableQuantity" <= p.moq
      ORDER BY i."availableQuantity" ASC, i."updatedAt" DESC
      LIMIT ${limit}
      OFFSET ${skip}
    `;
  }

  countLowStockAlerts(options: {
    alertStatus: AnalyticsInventoryAlertFilter;
  }): Promise<number> {
    const { alertStatus } = options;

    if (alertStatus === "ALL") {
      return this.db.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count
        FROM "Product" p
        INNER JOIN "Inventory" i ON i."productId" = p.id
        WHERE p."deletedAt" IS NULL
          AND i."availableQuantity" <= p.moq
      `.then((rows) => Number(rows[0]?.count ?? 0));
    }

    if (alertStatus === "OUT_OF_STOCK") {
      return this.db.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count
        FROM "Product" p
        INNER JOIN "Inventory" i ON i."productId" = p.id
        WHERE p."deletedAt" IS NULL
          AND i."availableQuantity" = 0
      `.then((rows) => Number(rows[0]?.count ?? 0));
    }

    return this.db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Product" p
      INNER JOIN "Inventory" i ON i."productId" = p.id
      WHERE p."deletedAt" IS NULL
        AND i."availableQuantity" > 0
        AND i."availableQuantity" <= p.moq
    `.then((rows) => Number(rows[0]?.count ?? 0));
  }
}
