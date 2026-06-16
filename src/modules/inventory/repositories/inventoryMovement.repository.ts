import {
  Prisma,
  type InventoryMovementType,
  type PrismaClient,
} from "../../../../generated/prisma/client.js";
import { DEDUPE_MOVEMENT_TYPES } from "../constants/inventory.constants.js";
import type { InventoryMovementRecord } from "../dto/inventory.dto.js";
import type { InventoryMovementSortField } from "../constants/inventory.constants.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

const movementSelect = {
  id: true,
  productId: true,
  actorUserId: true,
  quantityBefore: true,
  quantityAfter: true,
  quantityChanged: true,
  quantity: true,
  movementType: true,
  referenceId: true,
  reason: true,
  notes: true,
  createdAt: true,
  actor: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  },
} satisfies Prisma.InventoryMovementSelect;

export type InventoryMovementDetailRecord = Prisma.InventoryMovementGetPayload<{
  select: typeof movementSelect;
}>;

export interface CreateInventoryMovementData {
  productId: string;
  actorUserId?: string | null;
  quantityBefore: number;
  quantityAfter: number;
  quantityChanged: number;
  quantity: number;
  movementType: InventoryMovementType;
  referenceId?: string | null;
  reason?: string | null;
  notes?: string | null;
}

function isDedupeMovementType(movementType: InventoryMovementType): boolean {
  return (DEDUPE_MOVEMENT_TYPES as readonly string[]).includes(movementType);
}

export class InventoryMovementRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: CreateInventoryMovementData) {
    try {
      return await this.db.inventoryMovement.create({
        data: {
          productId: data.productId,
          actorUserId: data.actorUserId ?? null,
          quantityBefore: data.quantityBefore,
          quantityAfter: data.quantityAfter,
          quantityChanged: data.quantityChanged,
          quantity: data.quantity,
          movementType: data.movementType,
          referenceId: data.referenceId ?? null,
          reason: data.reason ?? null,
          notes: data.notes ?? null,
        },
        select: movementSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        data.referenceId &&
        isDedupeMovementType(data.movementType)
      ) {
        const existing = await this.db.inventoryMovement.findFirst({
          where: {
            productId: data.productId,
            referenceId: data.referenceId,
            movementType: data.movementType,
          },
          select: movementSelect,
        });
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  existsForOrderMovement(
    productId: string,
    referenceId: string,
    movementType: InventoryMovementType,
  ) {
    return this.db.inventoryMovement
      .count({
        where: {
          productId,
          referenceId,
          movementType,
        },
      })
      .then((count) => count > 0);
  }

  findByProductId(options: {
    productId: string;
    page: number;
    limit: number;
    sortBy: InventoryMovementSortField;
    sortOrder: "asc" | "desc";
    movementType?: InventoryMovementType;
  }) {
    const { productId, page, limit, sortBy, sortOrder, movementType } = options;
    const skip = (page - 1) * limit;

    return this.db.inventoryMovement.findMany({
      where: {
        productId,
        ...(movementType ? { movementType } : {}),
      },
      select: movementSelect,
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    });
  }

  countByProductId(
    productId: string,
    movementType?: InventoryMovementType,
  ) {
    return this.db.inventoryMovement.count({
      where: {
        productId,
        ...(movementType ? { movementType } : {}),
      },
    });
  }

  toMovementRecord(
    record: InventoryMovementDetailRecord,
  ): InventoryMovementRecord {
    return {
      id: record.id,
      productId: record.productId,
      actor: record.actor
        ? {
            id: record.actor.id,
            firstName: record.actor.firstName,
            lastName: record.actor.lastName,
            role: record.actor.role,
          }
        : null,
      quantityBefore: record.quantityBefore,
      quantityAfter: record.quantityAfter,
      quantityChanged: record.quantityChanged,
      quantity: record.quantity,
      movementType: record.movementType,
      referenceId: record.referenceId,
      reason: record.reason,
      notes: record.notes,
      createdAt: record.createdAt,
    };
  }
}
