/**
 * @openapi
 * tags:
 *   - name: Cart
 *     description: Buyer shopping cart management
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as cartController from "../controllers/cart.controller.js";
import { addCartItemBodySchema } from "../validators/addCartItem.schema.js";
import { cartItemIdParamSchema } from "../validators/cartItemParams.schema.js";
import { updateCartItemBodySchema } from "../validators/updateCartItem.schema.js";

export const cartRouter = Router();

/**
 * @openapi
 * /api/v1/cart:
 *   get:
 *     tags: [Cart]
 *     summary: Get buyer cart
 *     description: |
 *       Buyer only. Returns the authenticated buyer's cart with line items,
 *       product summaries, availability flags, and subtotal. Returns an empty
 *       cart when none exists yet.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Cart fetched successfully }
 *                 data:
 *                   $ref: '#/components/schemas/Cart'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — buyer only
 */
cartRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.cart.read),
  cartController.getCart,
);

/**
 * @openapi
 * /api/v1/cart/items:
 *   post:
 *     tags: [Cart]
 *     summary: Add item to cart
 *     description: |
 *       Buyer only. Validates product approval status, seller status, inventory,
 *       and single-seller cart rule. Creates the buyer cart on first add. If the
 *       product already exists in the cart, quantities are combined.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, quantity]
 *             properties:
 *               productId: { type: string, format: uuid }
 *               quantity: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Item added to cart successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — buyer only
 *       404:
 *         description: Product not found or unavailable
 *       409:
 *         description: Insufficient inventory
 */
cartRouter.post(
  "/items",
  authenticate,
  authorizePermission(permissions.cart.mutate),
  validate({ body: addCartItemBodySchema }),
  cartController.addCartItem,
);

/**
 * @openapi
 * /api/v1/cart/items/{itemId}:
 *   patch:
 *     tags: [Cart]
 *     summary: Update cart item quantity
 *     description: |
 *       Buyer only. Sets the absolute quantity for a cart line item after
 *       validating product availability, soft-delete status, MOQ, and inventory.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Cart item updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — buyer only
 *       404:
 *         description: Cart item or product not found
 *       409:
 *         description: Insufficient inventory
 */
cartRouter.patch(
  "/items/:itemId",
  authenticate,
  authorizePermission(permissions.cart.mutate),
  validate({
    params: cartItemIdParamSchema,
    body: updateCartItemBodySchema,
  }),
  cartController.updateCartItem,
);

/**
 * @openapi
 * /api/v1/cart/items/{itemId}:
 *   delete:
 *     tags: [Cart]
 *     summary: Remove cart item
 *     description: Buyer only. Removes a single line item from the buyer's cart.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Cart item removed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — buyer only
 *       404:
 *         description: Cart item not found
 */
cartRouter.delete(
  "/items/:itemId",
  authenticate,
  authorizePermission(permissions.cart.mutate),
  validate({ params: cartItemIdParamSchema }),
  cartController.removeCartItem,
);

/**
 * @openapi
 * /api/v1/cart:
 *   delete:
 *     tags: [Cart]
 *     summary: Clear cart
 *     description: Buyer only. Removes all items from the buyer's cart.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — buyer only
 */
cartRouter.delete(
  "/",
  authenticate,
  authorizePermission(permissions.cart.mutate),
  cartController.clearCart,
);

/**
 * @openapi
 * components:
 *   schemas:
 *     CartProductSummary:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         productName: { type: string, example: Portable Ultrasound Scanner }
 *         brand: { type: string, example: MedTech }
 *         model: { type: string, example: US-200 }
 *         productType: { type: string, example: Diagnostic }
 *         description: { type: string, example: Portable ultrasound for point-of-care imaging }
 *         pricing: { type: string, example: "125000.00" }
 *         moq: { type: integer, example: 1 }
 *         availableQuantity: { type: integer, example: 25 }
 *         primaryImageUrl: { type: string, nullable: true }
 *         seller:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid }
 *             businessName: { type: string, example: Acme Medical Supplies }
 *         isAvailable: { type: boolean, example: true }
 *     CartItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         productId: { type: string, format: uuid }
 *         quantity: { type: integer, example: 2 }
 *         unitPrice: { type: string, example: "125000.00" }
 *         lineTotal: { type: string, example: "250000.00" }
 *         product:
 *           $ref: '#/components/schemas/CartProductSummary'
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     Cart:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid, nullable: true }
 *         buyerId: { type: string, format: uuid }
 *         seller:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid }
 *             businessName: { type: string, example: Acme Medical Supplies }
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CartItem'
 *         itemCount: { type: integer, example: 2 }
 *         totalItems: { type: integer, example: 5 }
 *         subtotal: { type: string, example: "375000.00" }
 *         createdAt: { type: string, format: date-time, nullable: true }
 *         updatedAt: { type: string, format: date-time, nullable: true }
 */
