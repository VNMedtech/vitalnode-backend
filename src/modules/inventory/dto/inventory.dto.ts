import type { InventoryMovementType } from "../../../../generated/prisma/client.js";
import {
  INVENTORY_STATUS,
  type InventoryStatusValue,
} from "../constants/inventory.constants.js";
import type {
  InventoryDetailDto,
  InventoryMovementDto,
  LowStockAlertDto,
} from "../types/inventory.types.js";

export function calculateInventoryStatus(
  availableQuantity: number,
  moq: number,
): InventoryStatusValue {
  if (availableQuantity === 0) {
    return INVENTORY_STATUS.OUT_OF_STOCK;
  }
  if (availableQuantity <= moq) {
    return INVENTORY_STATUS.LOW_STOCK;
  }
  return INVENTORY_STATUS.IN_STOCK;
}

export interface InventoryRecord {
  id: string;
  productId: string;
  availableQuantity: number;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    productName: string;
    brand: string;
    model: string;
    moq: number;
    status: string;
  };
}

export interface InventoryMovementActorRecord {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface InventoryMovementRecord {
  id: string;
  productId: string;
  actor: InventoryMovementActorRecord | null;
  quantityBefore: number;
  quantityAfter: number;
  quantityChanged: number;
  quantity: number;
  movementType: InventoryMovementType;
  referenceId: string | null;
  reason: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface LowStockAlertRecord {
  productId: string;
  productName: string;
  brand: string;
  model: string;
  moq: number;
  availableQuantity: number;
  productStatus: string;
  updatedAt: Date;
}

export function toInventoryDetailDto(
  record: InventoryRecord,
): InventoryDetailDto {
  return {
    id: record.id,
    productId: record.productId,
    availableQuantity: record.availableQuantity,
    inventoryStatus: calculateInventoryStatus(
      record.availableQuantity,
      record.product.moq,
    ),
    product: {
      id: record.product.id,
      productName: record.product.productName,
      brand: record.product.brand,
      model: record.product.model,
      moq: record.product.moq,
      status: record.product.status,
    },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toInventoryMovementDto(
  record: InventoryMovementRecord,
): InventoryMovementDto {
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
    createdAt: record.createdAt.toISOString(),
  };
}

export function toLowStockAlertDto(
  record: LowStockAlertRecord,
): LowStockAlertDto {
  return {
    productId: record.productId,
    productName: record.productName,
    brand: record.brand,
    model: record.model,
    moq: record.moq,
    availableQuantity: record.availableQuantity,
    inventoryStatus: calculateInventoryStatus(
      record.availableQuantity,
      record.moq,
    ),
    productStatus: record.productStatus,
    updatedAt: record.updatedAt.toISOString(),
  };
}
