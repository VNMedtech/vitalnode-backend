import type { RequestHandler } from "express";
import { getIdempotencyKey } from "../../../middlewares/idempotency.middleware.js";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import type { InventoryProductIdParam } from "../validators/inventoryParams.schema.js";
import type { ListInventoryMovementsQueryInput } from "../validators/query.schema.js";
import type { ListLowStockAlertsQueryInput } from "../validators/query.schema.js";
import type { UpdateInventoryBody } from "../validators/updateInventory.schema.js";
import { InventoryService } from "../services/inventory.service.js";

const inventoryService = new InventoryService();

function requireAuthenticatedUser(req: Parameters<RequestHandler>[0]): {
  id: string;
  role: UserRole;
} {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }

  return {
    id: req.user.id,
    role: req.user.role,
  };
}

export const getInventory: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { productId } = req.params as InventoryProductIdParam;
    const inventory = await inventoryService.getInventory(
      actor.id,
      actor.role,
      productId,
    );
    res
      .status(200)
      .json(successResponse(inventory, "Inventory fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const updateInventory: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { productId } = req.params as InventoryProductIdParam;
    const body = req.body as UpdateInventoryBody;
    const inventory = await inventoryService.updateInventory(
      actor.id,
      actor.role,
      productId,
      body,
      getIdempotencyKey(req),
    );
    res
      .status(200)
      .json(successResponse(inventory, "Inventory updated successfully"));
  } catch (err) {
    next(err);
  }
};

export const listInventoryMovements: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { productId } = req.params as InventoryProductIdParam;
    const query = req.query as unknown as ListInventoryMovementsQueryInput;
    const result = await inventoryService.listMovements(
      actor.id,
      actor.role,
      productId,
      query,
    );
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Inventory movements fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const listLowStockAlerts: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const query = req.query as unknown as ListLowStockAlertsQueryInput;
    const result = await inventoryService.listLowStockAlerts(
      actor.id,
      actor.role,
      query,
    );
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Low stock alerts fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};
