/**
 * @openapi
 * tags:
 *   - name: Inventory
 *     description: Product inventory management, movement history, and stock alerts
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  requireIdempotencyKey,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as inventoryController from "../controllers/inventory.controller.js";
import { inventoryProductIdParamSchema } from "../validators/inventoryParams.schema.js";
import {
  listInventoryMovementsQuerySchema,
  listLowStockAlertsQuerySchema,
} from "../validators/query.schema.js";
import { updateInventoryBodySchema } from "../validators/updateInventory.schema.js";

export const inventoryRouter = Router();

/**
 * @openapi
 * /api/v1/inventory/alerts/low-stock:
 *   get:
 *     tags: [Inventory]
 *     summary: List low stock alerts
 *     description: |
 *       Sellers see alerts for their own products. Admins see all products
 *       where available quantity is at or below MOQ (low stock or out of stock).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: alertStatus
 *         schema:
 *           type: string
 *           enum: [ALL, LOW_STOCK, OUT_OF_STOCK]
 *           default: ALL
 *     responses:
 *       200:
 *         description: Low stock alerts fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — seller or admin only
 */
inventoryRouter.get(
  "/alerts/low-stock",
  authenticate,
  authorizePermission(permissions.inventory.read),
  validate({ query: listLowStockAlertsQuerySchema }),
  inventoryController.listLowStockAlerts,
);

/**
 * @openapi
 * /api/v1/inventory/{productId}:
 *   get:
 *     tags: [Inventory]
 *     summary: Get product inventory
 *     description: |
 *       Returns inventory quantity and derived status (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`).
 *       Seller must own the product; admin may access any product.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Inventory fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Inventory fetched successfully }
 *                 data:
 *                   $ref: '#/components/schemas/InventoryDetail'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Inventory not found
 */
inventoryRouter.get(
  "/:productId",
  authenticate,
  authorizePermission(permissions.inventory.read),
  validate({ params: inventoryProductIdParamSchema }),
  inventoryController.getInventory,
);

/**
 * @openapi
 * /api/v1/inventory/{productId}:
 *   patch:
 *     tags: [Inventory]
 *     summary: Update product inventory
 *     description: |
 *       Sets absolute available quantity. Creates a movement record and audit log
 *       inside a single transaction. Automatically syncs product `OUT_OF_STOCK` status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [availableQuantity]
 *             properties:
 *               availableQuantity:
 *                 type: integer
 *                 minimum: 0
 *                 example: 50
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 example: Restocked warehouse A
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Deprecated alias for reason
 *     responses:
 *       200:
 *         description: Inventory updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Inventory not found
 *       409:
 *         description: Product status does not allow inventory updates
 */
inventoryRouter.patch(
  "/:productId",
  authenticate,
  authorizePermission(permissions.inventory.update),
  requireIdempotencyKey,
  validate({
    params: inventoryProductIdParamSchema,
    body: updateInventoryBodySchema,
  }),
  inventoryController.updateInventory,
);

/**
 * @openapi
 * /api/v1/inventory/{productId}/movements:
 *   get:
 *     tags: [Inventory]
 *     summary: List inventory movement history
 *     description: |
 *       Paginated movement history for a product. Seller must own the product;
 *       admin may access any product.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: movementType
 *         schema:
 *           type: string
 *           enum: [MANUAL_ADJUSTMENT, MANUAL_INCREASE, MANUAL_DECREASE, ORDER_DEDUCTION, ORDER_CANCELLATION, ORDER_RESTORE, REFUND_RESTORATION, SYSTEM_CORRECTION]
 *     responses:
 *       200:
 *         description: Inventory movements fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Inventory not found
 */
inventoryRouter.get(
  "/:productId/movements",
  authenticate,
  authorizePermission(permissions.inventory.read),
  validate({
    params: inventoryProductIdParamSchema,
    query: listInventoryMovementsQuerySchema,
  }),
  inventoryController.listInventoryMovements,
);

/**
 * @openapi
 * components:
 *   schemas:
 *     InventoryProductSummary:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         productName: { type: string, example: Portable Ultrasound Scanner }
 *         brand: { type: string, example: Siemens }
 *         model: { type: string, example: ACUSON P500 }
 *         moq: { type: integer, example: 5 }
 *         status:
 *           type: string
 *           enum: [PENDING_APPROVAL, APPROVED, REJECTED, DISABLED, OUT_OF_STOCK]
 *     InventoryDetail:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         productId: { type: string, format: uuid }
 *         availableQuantity: { type: integer, example: 12 }
 *         inventoryStatus:
 *           type: string
 *           enum: [IN_STOCK, LOW_STOCK, OUT_OF_STOCK]
 *           description: Derived from availableQuantity and product MOQ
 *         product:
 *           $ref: '#/components/schemas/InventoryProductSummary'
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     InventoryMovement:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         productId: { type: string, format: uuid }
 *         actor:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid }
 *             firstName: { type: string }
 *             lastName: { type: string }
 *             role: { type: string }
 *         quantityBefore: { type: integer, example: 10 }
 *         quantityAfter: { type: integer, example: 15 }
 *         quantityChanged: { type: integer, example: 5 }
 *         quantity: { type: integer, example: 5 }
 *         movementType:
 *           type: string
 *           enum: [MANUAL_ADJUSTMENT, MANUAL_INCREASE, MANUAL_DECREASE, ORDER_DEDUCTION, ORDER_CANCELLATION, ORDER_RESTORE, REFUND_RESTORATION, SYSTEM_CORRECTION]
 *         referenceId: { type: string, nullable: true, example: order-uuid }
 *         reason: { type: string, nullable: true }
 *         notes: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *     LowStockAlert:
 *       type: object
 *       properties:
 *         productId: { type: string, format: uuid }
 *         productName: { type: string }
 *         brand: { type: string }
 *         model: { type: string }
 *         moq: { type: integer }
 *         availableQuantity: { type: integer }
 *         inventoryStatus:
 *           type: string
 *           enum: [LOW_STOCK, OUT_OF_STOCK]
 *         productStatus: { type: string }
 *         updatedAt: { type: string, format: date-time }
 */
