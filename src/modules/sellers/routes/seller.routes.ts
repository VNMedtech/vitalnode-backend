/**
 * @openapi
 * tags:
 *   - name: Sellers
 *     description: Admin seller management and approval workflows
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as sellerController from "../controllers/seller.controller.js";
import { disableSellerBodySchema } from "../validators/disableSeller.schema.js";
import { enableSellerBodySchema } from "../validators/enableSeller.schema.js";
import { listSellersQuerySchema } from "../validators/query.schema.js";
import { rejectSellerBodySchema } from "../validators/rejectSeller.schema.js";
import { approveSellerBodySchema } from "../validators/approveSeller.schema.js";
import { sellerIdParamSchema } from "../validators/sellerParams.schema.js";

export const sellerRouter = Router();

/**
 * @openapi
 * /api/v1/sellers:
 *   get:
 *     tags: [Sellers]
 *     summary: List sellers
 *     description: |
 *       Admin only. Returns paginated sellers with search and filters.
 *       Search matches business name, contact person, city, email, and user name.
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
 *           enum: [businessName, createdAt, updatedAt, approvalStatus]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: search
 *         schema: { type: string, maxLength: 120 }
 *         description: Broad search across business name, contact person, city, email, and user name
 *       - in: query
 *         name: companyName
 *         schema: { type: string, maxLength: 120 }
 *         description: Partial match on seller business name (maps to businessName)
 *       - in: query
 *         name: email
 *         schema: { type: string, maxLength: 120 }
 *         description: Partial match on linked user email
 *       - in: query
 *         name: approvalStatus
 *         schema:
 *           type: string
 *           enum: [PENDING_APPROVAL, ACTIVE, REJECTED, DISABLED]
 *       - in: query
 *         name: city
 *         schema: { type: string, maxLength: 120 }
 *       - in: query
 *         name: state
 *         schema: { type: string, maxLength: 120 }
 *       - in: query
 *         name: country
 *         schema: { type: string, maxLength: 120 }
 *     responses:
 *       200:
 *         description: Sellers fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Sellers fetched successfully }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SellerListItem'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page: { type: integer, example: 1 }
 *                     limit: { type: integer, example: 20 }
 *                     total: { type: integer, example: 42 }
 *                     totalPages: { type: integer, example: 3 }
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 */
sellerRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.sellers.read),
  validate({ query: listSellersQuerySchema }),
  sellerController.listSellers,
);

/**
 * @openapi
 * /api/v1/sellers/{id}:
 *   get:
 *     tags: [Sellers]
 *     summary: Get seller details
 *     description: Admin only. Returns seller profile, linked user summary, and verification documents.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Seller fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Seller fetched successfully }
 *                 data:
 *                   $ref: '#/components/schemas/SellerDetail'
 *       400:
 *         description: Invalid seller ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Seller not found
 */
sellerRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.sellers.read),
  validate({ params: sellerIdParamSchema }),
  sellerController.getSellerById,
);

/**
 * @openapi
 * /api/v1/sellers/{id}/approve:
 *   post:
 *     tags: [Sellers]
 *     summary: Approve a seller
 *     description: |
 *       Admin only. Transitions seller from `PENDING_APPROVAL` to `ACTIVE`.
 *       Invalid transitions return 409.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Seller approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Seller approved successfully }
 *                 data:
 *                   $ref: '#/components/schemas/SellerDetail'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Seller not found
 *       409:
 *         description: Invalid state transition
 */
sellerRouter.post(
  "/:id/approve",
  authenticate,
  authorizePermission(permissions.sellers.approve),
  validate({
    params: sellerIdParamSchema,
    body: approveSellerBodySchema,
  }),
  sellerController.approveSeller,
);

/**
 * @openapi
 * /api/v1/sellers/{id}/reject:
 *   post:
 *     tags: [Sellers]
 *     summary: Reject a seller
 *     description: |
 *       Admin only. Transitions seller from `PENDING_APPROVAL` to `REJECTED`.
 *       Invalid transitions return 409.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 example: Incomplete verification documents
 *     responses:
 *       200:
 *         description: Seller rejected successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Seller not found
 *       409:
 *         description: Invalid state transition
 */
sellerRouter.post(
  "/:id/reject",
  authenticate,
  authorizePermission(permissions.sellers.reject),
  validate({
    params: sellerIdParamSchema,
    body: rejectSellerBodySchema,
  }),
  sellerController.rejectSeller,
);

/**
 * @openapi
 * /api/v1/sellers/{id}/disable:
 *   patch:
 *     tags: [Sellers]
 *     summary: Disable a seller
 *     description: |
 *       Admin only. Transitions seller from `ACTIVE` to `DISABLED`.
 *       Disabled sellers cannot receive new orders and products must not appear publicly.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 example: Policy violation
 *     responses:
 *       200:
 *         description: Seller disabled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Seller not found
 *       409:
 *         description: Invalid state transition
 */
sellerRouter.patch(
  "/:id/disable",
  authenticate,
  authorizePermission(permissions.sellers.disable),
  validate({
    params: sellerIdParamSchema,
    body: disableSellerBodySchema,
  }),
  sellerController.disableSeller,
);

/**
 * @openapi
 * /api/v1/sellers/{id}/enable:
 *   patch:
 *     tags: [Sellers]
 *     summary: Re-enable a seller
 *     description: |
 *       Admin only. Transitions seller from `DISABLED` to `ACTIVE`.
 *       Rejected sellers cannot be re-enabled through this endpoint.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 example: Issue resolved
 *     responses:
 *       200:
 *         description: Seller re-enabled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Seller not found
 *       409:
 *         description: Invalid state transition
 */
sellerRouter.patch(
  "/:id/enable",
  authenticate,
  authorizePermission(permissions.sellers.enable),
  validate({
    params: sellerIdParamSchema,
    body: enableSellerBodySchema,
  }),
  sellerController.enableSeller,
);

/**
 * @openapi
 * components:
 *   schemas:
 *     SellerUserSummary:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         email: { type: string, format: email }
 *         firstName: { type: string }
 *         lastName: { type: string }
 *         phoneNumber: { type: string, nullable: true }
 *         status: { type: string, enum: [ACTIVE, DISABLED] }
 *     SellerListItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         userId: { type: string, format: uuid }
 *         businessName: { type: string, example: MedEquip Solutions }
 *         contactPerson: { type: string, example: Jane Doe }
 *         city: { type: string }
 *         state: { type: string }
 *         country: { type: string }
 *         approvalStatus:
 *           type: string
 *           enum: [PENDING_APPROVAL, ACTIVE, REJECTED, DISABLED]
 *         user:
 *           $ref: '#/components/schemas/SellerUserSummary'
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     SellerDocument:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         fileUrl: { type: string }
 *         fileType: { type: string }
 *         createdAt: { type: string, format: date-time }
 *     SellerDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/SellerListItem'
 *         - type: object
 *           properties:
 *             addressLine1: { type: string }
 *             addressLine2: { type: string, nullable: true }
 *             postalCode: { type: string }
 *             latitude: { type: string, nullable: true }
 *             longitude: { type: string, nullable: true }
 *             documents:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SellerDocument'
 */
