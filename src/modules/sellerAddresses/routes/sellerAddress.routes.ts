/**
 * @openapi
 * tags:
 *   - name: SellerAddresses
 *     description: Seller warehouse / pickup address management
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as sellerAddressController from "../controllers/sellerAddress.controller.js";
import { createSellerAddressBodySchema } from "../validators/createSellerAddress.schema.js";
import { listSellerAddressesQuerySchema } from "../validators/query.schema.js";
import { sellerAddressIdParamSchema } from "../validators/sellerAddressParams.schema.js";
import { updateSellerAddressBodySchema } from "../validators/updateSellerAddress.schema.js";

export const sellerAddressRouter = Router();

/**
 * @openapi
 * /api/v1/seller/addresses:
 *   get:
 *     tags: [SellerAddresses]
 *     summary: List seller warehouse addresses
 *     description: Seller only. Returns paginated warehouse addresses owned by the authenticated seller.
 *     security:
 *       - bearerAuth: []
 *   post:
 *     tags: [SellerAddresses]
 *     summary: Create a warehouse address
 *     description: |
 *       Seller only. The first address is automatically set as default.
 *       When `isDefault` is true, all other addresses are unset as default.
 *     security:
 *       - bearerAuth: []
 */
sellerAddressRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.sellerAddresses.read),
  validate({ query: listSellerAddressesQuerySchema }),
  sellerAddressController.listAddresses,
);

sellerAddressRouter.post(
  "/",
  authenticate,
  authorizePermission(permissions.sellerAddresses.create),
  validate({ body: createSellerAddressBodySchema }),
  sellerAddressController.createAddress,
);

/**
 * @openapi
 * /api/v1/seller/addresses/{id}:
 *   get:
 *     tags: [SellerAddresses]
 *     summary: Get warehouse address details
 *     security:
 *       - bearerAuth: []
 *   patch:
 *     tags: [SellerAddresses]
 *     summary: Update a warehouse address
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     tags: [SellerAddresses]
 *     summary: Delete or soft-disable a warehouse address
 *     description: |
 *       Hard-deletes unused addresses. Addresses referenced by orders are soft-disabled.
 *       Cannot remove the last active warehouse.
 *     security:
 *       - bearerAuth: []
 */
sellerAddressRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.sellerAddresses.read),
  validate({ params: sellerAddressIdParamSchema }),
  sellerAddressController.getAddress,
);

/**
 * @openapi
 * /api/v1/seller/addresses/{id}/default:
 *   patch:
 *     tags: [SellerAddresses]
 *     summary: Set warehouse address as default
 *     description: Seller only. Unsets default on all other addresses owned by the seller.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Default warehouse updated successfully
 *       404:
 *         description: Address not found
 */
sellerAddressRouter.patch(
  "/:id/default",
  authenticate,
  authorizePermission(permissions.sellerAddresses.setDefault),
  validate({ params: sellerAddressIdParamSchema }),
  sellerAddressController.setDefaultAddress,
);

/**
 * @openapi
 * /api/v1/seller/addresses/{id}/disable:
 *   patch:
 *     tags: [SellerAddresses]
 *     summary: Disable a warehouse address
 *     description: |
 *       Seller only. Soft-disables the address. Cannot disable the last active warehouse
 *       or the current default without first assigning another default.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Warehouse disabled successfully
 *       404:
 *         description: Address not found
 *       409:
 *         description: Cannot disable last active or default warehouse
 */
sellerAddressRouter.patch(
  "/:id/disable",
  authenticate,
  authorizePermission(permissions.sellerAddresses.delete),
  validate({ params: sellerAddressIdParamSchema }),
  sellerAddressController.disableAddress,
);

sellerAddressRouter.patch(
  "/:id",
  authenticate,
  authorizePermission(permissions.sellerAddresses.update),
  validate({
    params: sellerAddressIdParamSchema,
    body: updateSellerAddressBodySchema,
  }),
  sellerAddressController.updateAddress,
);

sellerAddressRouter.delete(
  "/:id",
  authenticate,
  authorizePermission(permissions.sellerAddresses.delete),
  validate({ params: sellerAddressIdParamSchema }),
  sellerAddressController.deleteAddress,
);

/**
 * @openapi
 * components:
 *   schemas:
 *     SellerAddress:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         label: { type: string, example: Primary warehouse }
 *         contactPerson: { type: string, nullable: true }
 *         phone: { type: string, nullable: true }
 *         addressLine1: { type: string }
 *         addressLine2: { type: string, nullable: true }
 *         city: { type: string }
 *         state: { type: string }
 *         country: { type: string }
 *         postalCode: { type: string }
 *         latitude: { type: string, nullable: true }
 *         longitude: { type: string, nullable: true }
 *         isDefault: { type: boolean }
 *         isActive: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */
