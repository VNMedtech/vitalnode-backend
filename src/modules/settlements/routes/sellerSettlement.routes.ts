/**
 * @openapi
 * tags:
 *   - name: Settlements
 *     description: Seller earnings and settlement batches
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  requireApprovedSeller,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as sellerSettlementController from "../controllers/sellerSettlement.controller.js";
import {
  listSettlementsQuerySchema,
  settlementIdParamSchema,
} from "../validators/settlement.schema.js";

export const sellerEarningsRouter = Router();

/**
 * @openapi
 * /api/v1/seller/earnings/summary:
 *   get:
 *     tags: [Settlements]
 *     summary: Seller earnings summary
 *     description: Approved seller only. Pending and settled earnings snapshot.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Earnings summary fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — approved seller only
 */
sellerEarningsRouter.get(
  "/summary",
  authenticate,
  authorizePermission(permissions.settlements.read),
  requireApprovedSeller,
  sellerSettlementController.getSellerEarningsSummary,
);

export const sellerSettlementRouter = Router();

/**
 * @openapi
 * /api/v1/seller/settlements:
 *   get:
 *     tags: [Settlements]
 *     summary: List seller settlement batches
 *     description: Approved seller only.
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
 *         description: Settlements listed successfully
 */
sellerSettlementRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.settlements.read),
  requireApprovedSeller,
  validate({ query: listSettlementsQuerySchema }),
  sellerSettlementController.listSellerSettlements,
);

/**
 * @openapi
 * /api/v1/seller/settlements/{id}:
 *   get:
 *     tags: [Settlements]
 *     summary: Get a seller settlement batch
 *     description: Approved seller only.
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
sellerSettlementRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.settlements.read),
  requireApprovedSeller,
  validate({ params: settlementIdParamSchema }),
  sellerSettlementController.getSellerSettlementById,
);
