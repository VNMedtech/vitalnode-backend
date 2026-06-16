/**
 * @openapi
 * tags:
 *   - name: Delivery Partners
 *     description: Admin delivery partner management
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as deliveryPartnerController from "../controllers/deliveryPartner.controller.js";
import { createDeliveryPartnerBodySchema } from "../validators/createDeliveryPartner.schema.js";
import { deliveryPartnerIdParamSchema } from "../validators/deliveryPartnerParams.schema.js";
import { disableDeliveryPartnerBodySchema } from "../validators/disableDeliveryPartner.schema.js";
import { enableDeliveryPartnerBodySchema } from "../validators/enableDeliveryPartner.schema.js";
import { listDeliveryPartnersQuerySchema } from "../validators/query.schema.js";
import { updateDeliveryPartnerBodySchema } from "../validators/updateDeliveryPartner.schema.js";

export const deliveryPartnerRouter = Router();

/**
 * @openapi
 * /api/v1/delivery-partners:
 *   get:
 *     tags: [Delivery Partners]
 *     summary: List delivery partners
 *     description: |
 *       Admin only. Returns paginated delivery partners with search and filters.
 *       Search matches name, email, phone, city, state, country, and postal code.
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
 *           enum: [createdAt, updatedAt, city, state, country]
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, DISABLED]
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
 *         description: Delivery partners fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Delivery partners fetched successfully }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DeliveryPartnerListItem'
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
deliveryPartnerRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.deliveryPartners.read),
  validate({ query: listDeliveryPartnersQuerySchema }),
  deliveryPartnerController.listDeliveryPartners,
);

/**
 * @openapi
 * /api/v1/delivery-partners/{id}:
 *   get:
 *     tags: [Delivery Partners]
 *     summary: Get delivery partner details
 *     description: Admin only. Returns delivery partner profile and linked user summary.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Delivery partner fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Delivery partner fetched successfully }
 *                 data:
 *                   $ref: '#/components/schemas/DeliveryPartnerDetail'
 *       400:
 *         description: Invalid delivery partner ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Delivery partner not found
 */
deliveryPartnerRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.deliveryPartners.read),
  validate({ params: deliveryPartnerIdParamSchema }),
  deliveryPartnerController.getDeliveryPartnerById,
);

/**
 * @openapi
 * /api/v1/delivery-partners:
 *   post:
 *     tags: [Delivery Partners]
 *     summary: Create a delivery partner
 *     description: |
 *       Admin only. Creates a delivery partner account with a generated temporary password.
 *       The account is flagged for mandatory password change on first login.
 *       The temporary password is returned once in the response and sent by email when configured.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - firstName
 *               - lastName
 *               - addressLine1
 *               - city
 *               - state
 *               - country
 *               - postalCode
 *             properties:
 *               email: { type: string, format: email }
 *               firstName: { type: string, minLength: 1, maxLength: 80 }
 *               lastName: { type: string, minLength: 1, maxLength: 80 }
 *               phoneNumber: { type: string, minLength: 8, maxLength: 20 }
 *               addressLine1: { type: string, minLength: 1, maxLength: 200 }
 *               addressLine2: { type: string, maxLength: 200 }
 *               city: { type: string, minLength: 1, maxLength: 100 }
 *               state: { type: string, minLength: 1, maxLength: 100 }
 *               country: { type: string, minLength: 1, maxLength: 100 }
 *               postalCode: { type: string, minLength: 1, maxLength: 20 }
 *     responses:
 *       201:
 *         description: Delivery partner created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Delivery partner created successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     deliveryPartner:
 *                       $ref: '#/components/schemas/DeliveryPartnerDetail'
 *                     temporaryPassword:
 *                       type: string
 *                       description: One-time temporary password for first login
 *                       example: Ab3!xY9mK2pQ
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       409:
 *         description: Email or phone number already registered
 */
deliveryPartnerRouter.post(
  "/",
  authenticate,
  authorizePermission(permissions.deliveryPartners.manage),
  validate({ body: createDeliveryPartnerBodySchema }),
  deliveryPartnerController.createDeliveryPartner,
);

/**
 * @openapi
 * /api/v1/delivery-partners/{id}:
 *   patch:
 *     tags: [Delivery Partners]
 *     summary: Update a delivery partner
 *     description: Admin only. Updates user and profile fields for a delivery partner.
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
 *             minProperties: 1
 *             properties:
 *               firstName: { type: string, minLength: 1, maxLength: 80 }
 *               lastName: { type: string, minLength: 1, maxLength: 80 }
 *               phoneNumber: { type: string, minLength: 8, maxLength: 20, nullable: true }
 *               addressLine1: { type: string, minLength: 1, maxLength: 200 }
 *               addressLine2: { type: string, maxLength: 200, nullable: true }
 *               city: { type: string, minLength: 1, maxLength: 100 }
 *               state: { type: string, minLength: 1, maxLength: 100 }
 *               country: { type: string, minLength: 1, maxLength: 100 }
 *               postalCode: { type: string, minLength: 1, maxLength: 20 }
 *     responses:
 *       200:
 *         description: Delivery partner updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Delivery partner not found
 *       409:
 *         description: Phone number already in use
 */
deliveryPartnerRouter.patch(
  "/:id",
  authenticate,
  authorizePermission(permissions.deliveryPartners.manage),
  validate({
    params: deliveryPartnerIdParamSchema,
    body: updateDeliveryPartnerBodySchema,
  }),
  deliveryPartnerController.updateDeliveryPartner,
);

/**
 * @openapi
 * /api/v1/delivery-partners/{id}/disable:
 *   patch:
 *     tags: [Delivery Partners]
 *     summary: Disable a delivery partner
 *     description: |
 *       Admin only. Disables the linked user account.
 *       Disabled delivery partners cannot receive new order assignments.
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
 *                 example: Inactive service area
 *     responses:
 *       200:
 *         description: Delivery partner disabled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Delivery partner not found
 *       409:
 *         description: Delivery partner is already disabled
 */
deliveryPartnerRouter.patch(
  "/:id/disable",
  authenticate,
  authorizePermission(permissions.deliveryPartners.manage),
  validate({
    params: deliveryPartnerIdParamSchema,
    body: disableDeliveryPartnerBodySchema,
  }),
  deliveryPartnerController.disableDeliveryPartner,
);

/**
 * @openapi
 * /api/v1/delivery-partners/{id}/enable:
 *   patch:
 *     tags: [Delivery Partners]
 *     summary: Re-enable a delivery partner
 *     description: Admin only. Re-enables a previously disabled delivery partner account.
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
 *                 example: Returned to active roster
 *     responses:
 *       200:
 *         description: Delivery partner re-enabled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Delivery partner not found
 *       409:
 *         description: Delivery partner is already active
 */
deliveryPartnerRouter.patch(
  "/:id/enable",
  authenticate,
  authorizePermission(permissions.deliveryPartners.manage),
  validate({
    params: deliveryPartnerIdParamSchema,
    body: enableDeliveryPartnerBodySchema,
  }),
  deliveryPartnerController.enableDeliveryPartner,
);

/**
 * @openapi
 * components:
 *   schemas:
 *     DeliveryPartnerUserSummary:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         email: { type: string, format: email }
 *         firstName: { type: string }
 *         lastName: { type: string }
 *         phoneNumber: { type: string, nullable: true }
 *         status: { type: string, enum: [ACTIVE, DISABLED] }
 *         mustChangePassword: { type: boolean, example: true }
 *     DeliveryPartnerListItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         userId: { type: string, format: uuid }
 *         addressLine1: { type: string }
 *         addressLine2: { type: string, nullable: true }
 *         city: { type: string }
 *         state: { type: string }
 *         country: { type: string }
 *         postalCode: { type: string }
 *         user:
 *           $ref: '#/components/schemas/DeliveryPartnerUserSummary'
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     DeliveryPartnerDetail:
 *       $ref: '#/components/schemas/DeliveryPartnerListItem'
 */
