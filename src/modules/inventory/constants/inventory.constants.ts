export const INVENTORY_AUDIT_ENTITY_TYPE = "INVENTORY" as const;

export const INVENTORY_ACTIONS = {
  UPDATED: "INVENTORY_UPDATED",
  ADJUSTED: "INVENTORY_ADJUSTED",
  DEDUCTED: "INVENTORY_DEDUCTED",
  RESTORED: "INVENTORY_RESTORED",
} as const;

export const INVENTORY_IDEMPOTENCY_ROUTES = {
  UPDATE: "PATCH /api/v1/inventory/:productId",
} as const;

/** Commerce order movements deduplicated by (referenceId, productId, movementType). */
export const DEDUPE_MOVEMENT_TYPES = [
  "ORDER_DEDUCTION",
  "ORDER_RESTORE",
  "ORDER_CANCELLATION",
  "REFUND_RESTORATION",
] as const;

export const INVENTORY_STATUS = {
  IN_STOCK: "IN_STOCK",
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
} as const;

export type InventoryStatusValue =
  (typeof INVENTORY_STATUS)[keyof typeof INVENTORY_STATUS];

export const INVENTORY_ALERT_FILTERS = [
  "ALL",
  "LOW_STOCK",
  "OUT_OF_STOCK",
] as const;

export type InventoryAlertFilter =
  (typeof INVENTORY_ALERT_FILTERS)[number];

export const INVENTORY_DEFAULT_PAGE = 1;
export const INVENTORY_DEFAULT_LIMIT = 20;
export const INVENTORY_MAX_LIMIT = 100;

export const INVENTORY_MOVEMENT_SORT_FIELDS = ["createdAt"] as const;
export type InventoryMovementSortField =
  (typeof INVENTORY_MOVEMENT_SORT_FIELDS)[number];

export const INVENTORY_NOTES_MAX_LENGTH = 500;
