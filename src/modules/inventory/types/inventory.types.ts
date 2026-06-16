import type { InventoryMovementType } from "../../../../generated/prisma/client.js";
import type {
  InventoryAlertFilter,
  InventoryMovementSortField,
  InventoryStatusValue,
} from "../constants/inventory.constants.js";

export interface InventoryProductSummary {
  id: string;
  productName: string;
  brand: string;
  model: string;
  moq: number;
  status: string;
}

export interface InventoryDetailDto {
  id: string;
  productId: string;
  availableQuantity: number;
  inventoryStatus: InventoryStatusValue;
  product: InventoryProductSummary;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovementActorDto {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface InventoryMovementDto {
  id: string;
  productId: string;
  actor: InventoryMovementActorDto | null;
  quantityBefore: number;
  quantityAfter: number;
  quantityChanged: number;
  quantity: number;
  movementType: InventoryMovementType;
  referenceId: string | null;
  reason: string | null;
  notes: string | null;
  createdAt: string;
}

export interface LowStockAlertDto {
  productId: string;
  productName: string;
  brand: string;
  model: string;
  moq: number;
  availableQuantity: number;
  inventoryStatus: InventoryStatusValue;
  productStatus: string;
  updatedAt: string;
}

export interface UpdateInventoryInput {
  availableQuantity: number;
  reason?: string;
  notes?: string;
}

export interface ListInventoryMovementsQuery {
  page: number;
  limit: number;
  sortBy: InventoryMovementSortField;
  sortOrder: "asc" | "desc";
  movementType?: InventoryMovementType;
}

export interface ListLowStockAlertsQuery {
  page: number;
  limit: number;
  alertStatus: InventoryAlertFilter;
}
