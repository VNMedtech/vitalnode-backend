import {
  Prisma,
  type PrismaClient,
  type ProductStatus as PrismaProductStatus,
} from "../../../../generated/prisma/client.js";
import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import type { InventoryAlertFilter } from "../constants/inventory.constants.js";
import type { InventoryRecord, LowStockAlertRecord } from "../dto/inventory.dto.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

const inventoryDetailSelect = {
  id: true,
  productId: true,
  availableQuantity: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      productName: true,
      brand: true,
      model: true,
      moq: true,
      status: true,
      sellerId: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.InventorySelect;

export type InventoryDetailRecord = Prisma.InventoryGetPayload<{
  select: typeof inventoryDetailSelect;
}>;

export class InventoryRepository {
  constructor(private readonly db: DbClient) {}

  findByProductId(productId: string) {
    return this.db.inventory.findUnique({
      where: { productId },
      select: inventoryDetailSelect,
    });
  }

  async setAvailableQuantity(
    productId: string,
    availableQuantity: number,
  ): Promise<InventoryDetailRecord> {
    return this.db.inventory.update({
      where: { productId },
      data: { availableQuantity },
      select: inventoryDetailSelect,
    });
  }

  /**
   * Atomic conditional decrement — returns new quantity or null if insufficient stock.
   */
  async decrementIfAvailable(
    productId: string,
    quantity: number,
  ): Promise<number | null> {
    const affected = await this.db.$executeRaw`
      UPDATE "Inventory"
      SET "availableQuantity" = "availableQuantity" - ${quantity},
          "updatedAt" = NOW()
      WHERE "productId" = ${productId}::uuid
        AND "availableQuantity" >= ${quantity}
    `;

    if (affected === 0) {
      return null;
    }

    const inventory = await this.db.inventory.findUnique({
      where: { productId },
      select: { availableQuantity: true },
    });

    return inventory?.availableQuantity ?? null;
  }

  async incrementQuantity(
    productId: string,
    quantity: number,
  ): Promise<number> {
    const updated = await this.db.inventory.update({
      where: { productId },
      data: {
        availableQuantity: { increment: quantity },
      },
      select: { availableQuantity: true },
    });

    return updated.availableQuantity;
  }

  async syncProductStatusFromQuantity(
    productId: string,
    currentProductStatus: ProductStatus,
    availableQuantity: number,
  ): Promise<ProductStatus | null> {
    if (
      availableQuantity === 0 &&
      currentProductStatus === ProductStatus.APPROVED
    ) {
      await this.db.product.update({
        where: { id: productId },
        data: { status: ProductStatus.OUT_OF_STOCK as PrismaProductStatus },
      });
      return ProductStatus.OUT_OF_STOCK;
    }

    if (
      availableQuantity > 0 &&
      currentProductStatus === ProductStatus.OUT_OF_STOCK
    ) {
      await this.db.product.update({
        where: { id: productId },
        data: { status: ProductStatus.APPROVED as PrismaProductStatus },
      });
      return ProductStatus.APPROVED;
    }

    return null;
  }

  findLowStockAlerts(
    options: {
      sellerId?: string;
      alertStatus: InventoryAlertFilter;
      page: number;
      limit: number;
    },
  ): Promise<LowStockAlertRecord[]> {
    const { sellerId, alertStatus, page, limit } = options;
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
          ${sellerId ? Prisma.sql`AND p."sellerId" = ${sellerId}::uuid` : Prisma.empty}
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
          ${sellerId ? Prisma.sql`AND p."sellerId" = ${sellerId}::uuid` : Prisma.empty}
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
        ${sellerId ? Prisma.sql`AND p."sellerId" = ${sellerId}::uuid` : Prisma.empty}
      ORDER BY i."availableQuantity" ASC, i."updatedAt" DESC
      LIMIT ${limit}
      OFFSET ${skip}
    `;
  }

  countLowStockAlerts(options: {
    sellerId?: string;
    alertStatus: InventoryAlertFilter;
  }): Promise<number> {
    const { sellerId, alertStatus } = options;

    if (alertStatus === "ALL") {
      return this.db.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count
        FROM "Product" p
        INNER JOIN "Inventory" i ON i."productId" = p.id
        WHERE p."deletedAt" IS NULL
          AND i."availableQuantity" <= p.moq
          ${sellerId ? Prisma.sql`AND p."sellerId" = ${sellerId}::uuid` : Prisma.empty}
      `.then((rows) => Number(rows[0]?.count ?? 0));
    }

    if (alertStatus === "OUT_OF_STOCK") {
      return this.db.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count
        FROM "Product" p
        INNER JOIN "Inventory" i ON i."productId" = p.id
        WHERE p."deletedAt" IS NULL
          AND i."availableQuantity" = 0
          ${sellerId ? Prisma.sql`AND p."sellerId" = ${sellerId}::uuid` : Prisma.empty}
      `.then((rows) => Number(rows[0]?.count ?? 0));
    }

    return this.db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Product" p
      INNER JOIN "Inventory" i ON i."productId" = p.id
      WHERE p."deletedAt" IS NULL
        AND i."availableQuantity" > 0
        AND i."availableQuantity" <= p.moq
        ${sellerId ? Prisma.sql`AND p."sellerId" = ${sellerId}::uuid` : Prisma.empty}
    `.then((rows) => Number(rows[0]?.count ?? 0));
  }

  toInventoryRecord(record: InventoryDetailRecord): InventoryRecord | null {
    if (record.product.deletedAt !== null) {
      return null;
    }

    return {
      id: record.id,
      productId: record.productId,
      availableQuantity: record.availableQuantity,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      product: {
        id: record.product.id,
        productName: record.product.productName,
        brand: record.product.brand,
        model: record.product.model,
        moq: record.product.moq,
        status: record.product.status,
      },
    };
  }
}
