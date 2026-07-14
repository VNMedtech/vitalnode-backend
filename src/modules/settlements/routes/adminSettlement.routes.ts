/**
 * @openapi
 * tags:
 *   - name: Admin Settlements
 *     description: Admin settlement batch management and seller commission
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import { updateSellerCommissionBodySchema } from "../../sellers/validators/approveSeller.schema.js";
import { sellerIdParamSchema } from "../../sellers/validators/sellerParams.schema.js";
import * as adminSettlementController from "../controllers/adminSettlement.controller.js";
import {
  createSettlementBatchBodySchema,
  disburseSettlementBatchBodySchema,
  listSettlementsQuerySchema,
  settlementIdParamSchema,
  settlementSellerIdParamSchema,
} from "../validators/settlement.schema.js";

export const adminSettlementRouter = Router();

/**
 * @openapi
 * /api/v1/admin/settlements/pending:
 *   get:
 *     tags: [Admin Settlements]
 *     summary: List sellers with pending settlement amounts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending settlements listed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 */
adminSettlementRouter.get(
  "/pending",
  authenticate,
  authorizePermission(permissions.settlements.manage),
  adminSettlementController.listPendingSettlements,
);

/**
 * @openapi
 * /api/v1/admin/settlements/seller/{sellerId}:
 *   get:
 *     tags: [Admin Settlements]
 *     summary: Get pending settlement detail for a seller
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sellerId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Seller pending settlement detail fetched successfully
 *       404:
 *         description: Seller not found
 */
adminSettlementRouter.get(
  "/seller/:sellerId",
  authenticate,
  authorizePermission(permissions.settlements.manage),
  validate({ params: settlementSellerIdParamSchema }),
  adminSettlementController.getSellerPendingSettlementDetail,
);

/**
 * @openapi
 * /api/v1/admin/settlements:
 *   get:
 *     tags: [Admin Settlements]
 *     summary: List settlement batch history
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
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, disbursedAt, batchNumber, grossAmount, netAmount]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: sellerId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, DISBURSED] }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Settlement history listed successfully
 *   post:
 *     tags: [Admin Settlements]
 *     summary: Create a settlement batch
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sellerId, orderIds]
 *             properties:
 *               sellerId: { type: string, format: uuid }
 *               orderIds:
 *                 type: array
 *                 minItems: 1
 *                 items: { type: string, format: uuid }
 *               remarks: { type: string, maxLength: 500 }
 *     responses:
 *       201:
 *         description: Settlement batch created successfully
 *       400:
 *         description: Validation failed
 */
adminSettlementRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.settlements.manage),
  validate({ query: listSettlementsQuerySchema }),
  adminSettlementController.listSettlementHistory,
);

/**
 * @openapi
 * /api/v1/admin/settlements/{id}:
 *   get:
 *     tags: [Admin Settlements]
 *     summary: Get a settlement batch by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Settlement batch fetched successfully
 *       404:
 *         description: Settlement batch not found
 */
adminSettlementRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.settlements.manage),
  validate({ params: settlementIdParamSchema }),
  adminSettlementController.getSettlementBatchById,
);

adminSettlementRouter.post(
  "/",
  authenticate,
  authorizePermission(permissions.settlements.manage),
  validate({ body: createSettlementBatchBodySchema }),
  adminSettlementController.createSettlementBatch,
);

/**
 * @openapi
 * /api/v1/admin/settlements/{id}/disburse:
 *   patch:
 *     tags: [Admin Settlements]
 *     summary: Disburse a settlement batch
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentReference]
 *             properties:
 *               paymentReference: { type: string, minLength: 1, maxLength: 120 }
 *               remarks: { type: string, maxLength: 500 }
 *     responses:
 *       200:
 *         description: Settlement batch disbursed successfully
 *       404:
 *         description: Settlement batch not found
 *       409:
 *         description: Batch already disbursed or invalid state
 */
adminSettlementRouter.patch(
  "/:id/disburse",
  authenticate,
  authorizePermission(permissions.settlements.manage),
  validate({
    params: settlementIdParamSchema,
    body: disburseSettlementBatchBodySchema,
  }),
  adminSettlementController.disburseSettlementBatch,
);

export const adminSellerCommissionRouter = Router();

/**
 * @openapi
 * /api/v1/admin/sellers/{id}/commission:
 *   patch:
 *     tags: [Admin Settlements]
 *     summary: Update a seller commission percentage
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [commissionPercentage]
 *             properties:
 *               commissionPercentage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *     responses:
 *       200:
 *         description: Seller commission updated successfully
 *       404:
 *         description: Seller not found
 */
adminSellerCommissionRouter.patch(
  "/:id/commission",
  authenticate,
  authorizePermission(permissions.settlements.manage),
  validate({
    params: sellerIdParamSchema,
    body: updateSellerCommissionBodySchema,
  }),
  adminSettlementController.updateSellerCommission,
);
