import { z } from "zod";
import { InventoryMovementType } from "../../../../generated/prisma/client.js";
import {
  INVENTORY_ALERT_FILTERS,
  INVENTORY_DEFAULT_LIMIT,
  INVENTORY_DEFAULT_PAGE,
  INVENTORY_MAX_LIMIT,
  INVENTORY_MOVEMENT_SORT_FIELDS,
} from "../constants/inventory.constants.js";

export const listInventoryMovementsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(INVENTORY_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(INVENTORY_MAX_LIMIT)
      .default(INVENTORY_DEFAULT_LIMIT),
    sortBy: z.enum(INVENTORY_MOVEMENT_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    movementType: z.nativeEnum(InventoryMovementType).optional(),
  })
  .strict();

export type ListInventoryMovementsQueryInput = z.infer<
  typeof listInventoryMovementsQuerySchema
>;

export const listLowStockAlertsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(INVENTORY_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(INVENTORY_MAX_LIMIT)
      .default(INVENTORY_DEFAULT_LIMIT),
    alertStatus: z.enum(INVENTORY_ALERT_FILTERS).default("ALL"),
  })
  .strict();

export type ListLowStockAlertsQueryInput = z.infer<
  typeof listLowStockAlertsQuerySchema
>;
