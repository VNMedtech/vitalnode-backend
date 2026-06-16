/**
 * @openapi
 * tags:
 *   - name: Addresses
 *     description: Buyer shipping address management
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as addressController from "../controllers/address.controller.js";
import { addressIdParamSchema } from "../validators/addressParams.schema.js";
import { createAddressBodySchema } from "../validators/createAddress.schema.js";
import { listAddressesQuerySchema } from "../validators/query.schema.js";
import { updateAddressBodySchema } from "../validators/updateAddress.schema.js";

export const addressRouter = Router();

/**
 * @openapi
 * /api/v1/addresses:
 *   get:
 *     tags: [Addresses]
 *     summary: List buyer addresses
 *     description: Buyer only. Returns paginated addresses owned by the authenticated buyer.
 *     security:
 *       - bearerAuth: []
 */
addressRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.addresses.read),
  validate({ query: listAddressesQuerySchema }),
  addressController.listAddresses,
);

/**
 * @openapi
 * /api/v1/addresses:
 *   post:
 *     tags: [Addresses]
 *     summary: Create a buyer address
 *     description: |
 *       Buyer only. The first address is automatically set as default.
 *       When `isDefault` is true, all other addresses are unset as default.
 *     security:
 *       - bearerAuth: []
 */
addressRouter.post(
  "/",
  authenticate,
  authorizePermission(permissions.addresses.create),
  validate({ body: createAddressBodySchema }),
  addressController.createAddress,
);

/**
 * @openapi
 * /api/v1/addresses/{id}:
 *   get:
 *     tags: [Addresses]
 *     summary: Get address details
 *     description: Buyer only. Returns a single address owned by the authenticated buyer.
 *     security:
 *       - bearerAuth: []
 */
addressRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.addresses.read),
  validate({ params: addressIdParamSchema }),
  addressController.getAddress,
);

/**
 * @openapi
 * /api/v1/addresses/{id}/default:
 *   patch:
 *     tags: [Addresses]
 *     summary: Set default address
 *     description: Buyer only. Clears existing default and sets the selected address as default in a transaction.
 *     security:
 *       - bearerAuth: []
 */
addressRouter.patch(
  "/:id/default",
  authenticate,
  authorizePermission(permissions.addresses.setDefault),
  validate({ params: addressIdParamSchema }),
  addressController.setDefaultAddress,
);

/**
 * @openapi
 * /api/v1/addresses/{id}:
 *   patch:
 *     tags: [Addresses]
 *     summary: Update a buyer address
 *     description: Buyer only. Buyers can only update their own addresses.
 *     security:
 *       - bearerAuth: []
 */
addressRouter.patch(
  "/:id",
  authenticate,
  authorizePermission(permissions.addresses.update),
  validate({
    params: addressIdParamSchema,
    body: updateAddressBodySchema,
  }),
  addressController.updateAddress,
);

/**
 * @openapi
 * /api/v1/addresses/{id}:
 *   delete:
 *     tags: [Addresses]
 *     summary: Delete a buyer address
 *     description: |
 *       Buyer only. Deleting the default address is allowed; no replacement default is set.
 *     security:
 *       - bearerAuth: []
 */
addressRouter.delete(
  "/:id",
  authenticate,
  authorizePermission(permissions.addresses.delete),
  validate({ params: addressIdParamSchema }),
  addressController.deleteAddress,
);

/**
 * @openapi
 * components:
 *   schemas:
 *     Address:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         recipientName: { type: string, example: Dr. Jane Smith }
 *         phoneNumber: { type: string, example: "+919876543210" }
 *         addressLine1: { type: string, example: 42 Medical Lane }
 *         addressLine2: { type: string, nullable: true, example: Suite 3B }
 *         city: { type: string, example: Mumbai }
 *         state: { type: string, example: Maharashtra }
 *         country: { type: string, example: India }
 *         postalCode: { type: string, example: "400001" }
 *         isDefault: { type: boolean, example: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */
