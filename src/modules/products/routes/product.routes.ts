/**
 * @openapi
 * tags:
 *   - name: Products
 *     description: Product catalog, seller management, and admin approval workflows
 */
import { Router } from "express";
import {
  authenticate,
  authorize,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as productController from "../controllers/product.controller.js";
import { productFileUpload } from "../middleware/productUpload.middleware.js";
import {
  createProductMultipartBodySchema,
  updateProductMultipartBodySchema,
} from "../validators/productMultipart.schema.js";
import { productIdParamSchema } from "../validators/productParams.schema.js";
import {
  listAdminProductsQuerySchema,
  listMarketplaceProductsQuerySchema,
  listOwnProductsQuerySchema,
  listPendingProductsQuerySchema,
} from "../validators/query.schema.js";
import { rejectProductBodySchema } from "../validators/rejectProduct.schema.js";
import { compareProductsQuerySchema } from "../validators/compareProducts.schema.js";
import { attachTemplateBodySchema } from "../validators/attachTemplate.schema.js";
import * as reviewController from "../../reviews/controllers/review.controller.js";
import {
  listProductReviewsQuerySchema,
} from "../../reviews/validators/query.schema.js";
import { productReviewsParamSchema } from "../../reviews/validators/reviewParams.schema.js";

export const productRouter = Router();

/**
 * @openapi
 * /api/v1/products:
 *   get:
 *     tags: [Products]
 *     summary: Marketplace product listing
 *     description: |
 *       Public endpoint. Returns paginated approved products from active sellers
 *       in active categories. Supports search, filters, and sorting.
 *       Default sort (when sortBy and sortOrder are omitted): pricing ascending.
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
 *           enum: [price, newest]
 *         description: Optional. Omit with sortOrder for default pricing ascending
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Optional. Used only when sortBy is provided
 *       - in: query
 *         name: search
 *         schema: { type: string, maxLength: 120 }
 *         description: Case-insensitive search across product name, brand, and model
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *         description: Filter products linked to this category (any of product categories)
 *       - in: query
 *         name: categoryIds
 *         schema:
 *           type: array
 *           items: { type: string, format: uuid }
 *           minItems: 1
 *         style: form
 *         explode: true
 *         description: |
 *           Filter products that belong to any of these categories (OR / any-of).
 *           Accepts repeated query params or a comma-separated list.
 *           When both categoryId and categoryIds are provided, categoryIds wins.
 *       - in: query
 *         name: brand
 *         schema: { type: string, maxLength: 120 }
 *       - in: query
 *         name: minPrice
 *         schema: { type: string, example: "100.00" }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: string, example: "5000.00" }
 *     responses:
 *       200:
 *         description: Products fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Products fetched successfully }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ProductListItem'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       400:
 *         description: Validation failed
 */
productRouter.get(
  "/",
  validate({ query: listMarketplaceProductsQuerySchema }),
  productController.listMarketplaceProducts,
);

/**
 * @openapi
 * /api/v1/products/compare:
 *   get:
 *     tags: [Products]
 *     summary: Compare marketplace products
 *     description: |
 *       Public endpoint. Compares 2 to 4 approved, marketplace-visible products side by side.
 *       Products must share at least one category (non-empty intersection across the full set).
 *       Returns core commerce rows plus the union of template attribute keys across the
 *       selected products (shared keys first, then product-specific), aligned to the
 *       requested product order.
 *     parameters:
 *       - in: query
 *         name: productIds
 *         required: true
 *         schema:
 *           type: array
 *           minItems: 2
 *           maxItems: 4
 *           items:
 *             type: string
 *             format: uuid
 *         style: form
 *         explode: true
 *         description: |
 *           Product UUIDs to compare (2–4). Repeat the parameter
 *           (`?productIds=uuid1&productIds=uuid2`) or pass a comma-separated list.
 *     responses:
 *       200:
 *         description: Products compared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Products compared successfully }
 *                 data:
 *                   $ref: '#/components/schemas/ProductCompare'
 *       400:
 *         description: Validation failed, or products do not share a common category
 *       404:
 *         description: One or more products are not available for comparison
 */
productRouter.get(
  "/compare",
  validate({ query: compareProductsQuerySchema }),
  productController.compareMarketplaceProducts,
);

/**
 * @openapi
 * /api/v1/products/mine:
 *   get:
 *     tags: [Products]
 *     summary: List own products
 *     description: |
 *       Seller only. Returns paginated products owned by the authenticated seller.
 *       Requires an approved seller account.
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
 *           enum: [price, newest]
 *           default: newest
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
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *         description: Filter by any linked ProductCategory
 *       - in: query
 *         name: brand
 *         schema: { type: string, maxLength: 120 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING_APPROVAL, APPROVED, REJECTED, DISABLED, OUT_OF_STOCK]
 *       - in: query
 *         name: minPrice
 *         schema: { type: string, example: "100.00" }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: string, example: "5000.00" }
 *     responses:
 *       200:
 *         description: Your products fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — approved seller only
 */
productRouter.get(
  "/mine",
  authenticate,
  authorizePermission(permissions.products.read),
  validate({ query: listOwnProductsQuerySchema }),
  productController.listOwnProducts,
);

/**
 * @openapi
 * /api/v1/products:
 *   post:
 *     tags: [Products]
 *     summary: Create a product
 *     description: |
 *       Seller only. Creates a product in `PENDING_APPROVAL` status (multipart/form-data).
 *       Only approved sellers may create products. Requires `categoryIds` (min 1).
 *       Template is optional on create; admin must attach a template before approval.
 *       Physical/spec values belong in optional `attributes` JSON when a template is used.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/CreateProductRequest'
 *               - type: object
 *                 properties:
 *                   images:
 *                     type: array
 *                     items: { type: string, format: binary }
 *                   documents:
 *                     type: array
 *                     items: { type: string, format: binary }
 *                   documentTypes:
 *                     type: string
 *                     description: JSON array of document type strings matching documents order
 *                     example: '["manual"]'
 *                   categoryIds:
 *                     type: string
 *                     description: JSON array of category UUIDs
 *                     example: '["550e8400-e29b-41d4-a716-446655440000"]'
 *                   attributes:
 *                     type: string
 *                     description: JSON object of template-driven attribute values
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Product created successfully }
 *                 data:
 *                   $ref: '#/components/schemas/ProductDetail'
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — approved seller only
 *       404:
 *         description: Category or template not found
 */
productRouter.post(
  "/",
  authenticate,
  authorizePermission(permissions.products.create),
  productFileUpload,
  validate({ body: createProductMultipartBodySchema }),
  productController.createProduct,
);

/**
 * @openapi
 * /api/v1/products/mine/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get own product details
 *     description: Seller only. Returns full product details for a product owned by the authenticated seller.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Product fetched successfully }
 *                 data:
 *                   $ref: '#/components/schemas/ProductDetail'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — approved seller only
 *       404:
 *         description: Product not found
 */
productRouter.get(
  "/mine/:id",
  authenticate,
  authorizePermission(permissions.products.read),
  validate({ params: productIdParamSchema }),
  productController.getOwnProductById,
);

/**
 * @openapi
 * /api/v1/products/pending:
 *   get:
 *     tags: [Products]
 *     summary: List pending products
 *     description: |
 *       Admin only. Returns paginated products awaiting approval (`PENDING_APPROVAL`).
 *       Supports search, filters, and sorting.
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
 *           enum: [price, newest]
 *           default: newest
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
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: brand
 *         schema: { type: string, maxLength: 120 }
 *       - in: query
 *         name: minPrice
 *         schema: { type: string, example: "100.00" }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: string, example: "5000.00" }
 *     responses:
 *       200:
 *         description: Pending products fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 */
productRouter.get(
  "/pending",
  authenticate,
  authorizePermission(permissions.products.approve),
  validate({ query: listPendingProductsQuerySchema }),
  productController.listPendingProducts,
);

/**
 * @openapi
 * /api/v1/products/pending/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get pending product details
 *     description: |
 *       Admin only. Returns full product details for a product awaiting approval
 *       (`PENDING_APPROVAL`), including media, documents, attributes, and inventory.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Pending product fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Pending product fetched successfully }
 *                 data:
 *                   $ref: '#/components/schemas/ProductDetail'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Product not found or not pending approval
 */
productRouter.get(
  "/pending/:id",
  authenticate,
  authorizePermission(permissions.products.approve),
  validate({ params: productIdParamSchema }),
  productController.getPendingProductById,
);

/**
 * @openapi
 * /api/v1/products/admin:
 *   get:
 *     tags: [Products]
 *     summary: List all products (admin)
 *     description: |
 *       Admin only. Returns paginated products across all statuses.
 *       Supports search, status, seller, brand, category, and price filters.
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
 *           enum: [price, newest]
 *           default: newest
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
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: brand
 *         schema: { type: string, maxLength: 120 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING_APPROVAL, APPROVED, REJECTED, DISABLED, OUT_OF_STOCK]
 *       - in: query
 *         name: sellerId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: minPrice
 *         schema: { type: string, example: "100.00" }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: string, example: "5000.00" }
 *     responses:
 *       200:
 *         description: Products fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
productRouter.get(
  "/admin",
  authenticate,
  authorize([UserRole.ADMIN]),
  authorizePermission(permissions.products.read),
  validate({ query: listAdminProductsQuerySchema }),
  productController.listAdminProducts,
);

/**
 * @openapi
 * /api/v1/products/admin/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get product details (admin)
 *     description: |
 *       Admin only. Returns full product details for any non-deleted product,
 *       including media, documents, attributes, template, inventory, and seller.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Product not found
 */
productRouter.get(
  "/admin/:id",
  authenticate,
  authorize([UserRole.ADMIN]),
  authorizePermission(permissions.products.read),
  validate({ params: productIdParamSchema }),
  productController.getAdminProductById,
);

/**
 * @openapi
 * /api/v1/products/admin/{id}:
 *   patch:
 *     tags: [Products]
 *     summary: Update a product (admin)
 *     description: |
 *       Admin only. Updates any editable product (multipart/form-data).
 *       Core commerce/copy/media/docs changes on APPROVED products stay APPROVED
 *       (no re-approval queue).
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
 *         multipart/form-data:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/UpdateProductRequest'
 *               - type: object
 *                 properties:
 *                   images:
 *                     type: array
 *                     items: { type: string, format: binary }
 *                   documents:
 *                     type: array
 *                     items: { type: string, format: binary }
 *                   documentTypes:
 *                     type: string
 *                     description: JSON array of document type strings
 *                   categoryIds:
 *                     type: string
 *                     description: JSON array of category UUIDs
 *                   attributes:
 *                     type: string
 *                     description: JSON object of template-driven attribute values
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Product not found
 *       409:
 *         description: Product cannot be updated in its current status
 */
productRouter.patch(
  "/admin/:id",
  authenticate,
  authorize([UserRole.ADMIN]),
  authorizePermission(permissions.products.update),
  productFileUpload,
  validate({
    params: productIdParamSchema,
    body: updateProductMultipartBodySchema,
  }),
  productController.updateAdminProduct,
);

/**
 * @openapi
 * /api/v1/products/admin/{id}/disable:
 *   post:
 *     tags: [Products]
 *     summary: Disable a product (admin)
 *     description: |
 *       Admin only. Transitions product from `APPROVED` to `DISABLED`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product disabled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Product not found
 *       409:
 *         description: Invalid state transition
 */
productRouter.post(
  "/admin/:id/disable",
  authenticate,
  authorize([UserRole.ADMIN]),
  authorizePermission(permissions.products.delete),
  validate({ params: productIdParamSchema }),
  productController.disableAdminProduct,
);

/**
 * @openapi
 * /api/v1/products/admin/{id}/enable:
 *   post:
 *     tags: [Products]
 *     summary: Enable a product (admin)
 *     description: |
 *       Admin only. Transitions product from `DISABLED` (or `OUT_OF_STOCK`) to `APPROVED`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product enabled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Product not found
 *       409:
 *         description: Invalid state transition
 */
productRouter.post(
  "/admin/:id/enable",
  authenticate,
  authorize([UserRole.ADMIN]),
  authorizePermission(permissions.products.update),
  validate({ params: productIdParamSchema }),
  productController.enableAdminProduct,
);

/**
 * @openapi
 * /api/v1/products/{id}:
 *   patch:
 *     tags: [Products]
 *     summary: Update a product
 *     description: |
 *       Seller only. Updates a product owned by the authenticated seller (multipart/form-data).
 *       Core commerce/copy/media/docs changes on APPROVED products set status back to PENDING_APPROVAL.
 *       Attributes-only edits on APPROVED products stay APPROVED. Orphan attribute keys are kept.
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
 *         multipart/form-data:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/UpdateProductRequest'
 *               - type: object
 *                 properties:
 *                   images:
 *                     type: array
 *                     items: { type: string, format: binary }
 *                   documents:
 *                     type: array
 *                     items: { type: string, format: binary }
 *                   documentTypes:
 *                     type: string
 *                     description: JSON array of document type strings
 *                   categoryIds:
 *                     type: string
 *                     description: JSON array of category UUIDs
 *                   attributes:
 *                     type: string
 *                     description: JSON object of template-driven attribute values
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — approved seller only
 *       404:
 *         description: Product not found
 *       409:
 *         description: Product cannot be updated in its current status
 */
productRouter.patch(
  "/:id",
  authenticate,
  authorizePermission(permissions.products.update),
  productFileUpload,
  validate({
    params: productIdParamSchema,
    body: updateProductMultipartBodySchema,
  }),
  productController.updateProduct,
);

/**
 * @openapi
 * /api/v1/products/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Disable a product
 *     description: |
 *       Seller only. Transitions product from `APPROVED` to `DISABLED`.
 *       Invalid transitions return 409.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product disabled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — approved seller only
 *       404:
 *         description: Product not found
 *       409:
 *         description: Invalid state transition
 */
productRouter.delete(
  "/:id",
  authenticate,
  authorizePermission(permissions.products.delete),
  validate({ params: productIdParamSchema }),
  productController.disableProduct,
);

/**
 * @openapi
 * /api/v1/products/{id}/approve:
 *   post:
 *     tags: [Products]
 *     summary: Approve a product
 *     description: |
 *       Admin only. Transitions product from `PENDING_APPROVAL` to `APPROVED`.
 *       Requires an attached `templateId`. Returns 400 if template is missing.
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
 *         description: Product approved successfully
 *       400:
 *         description: Template not attached
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Product not found
 *       409:
 *         description: Invalid state transition
 */
productRouter.post(
  "/:id/approve",
  authenticate,
  authorizePermission(permissions.products.approve),
  validate({ params: productIdParamSchema }),
  productController.approveProduct,
);

/**
 * @openapi
 * /api/v1/products/{id}/attach-template:
 *   post:
 *     tags: [Products]
 *     summary: Attach a product template
 *     description: |
 *       Admin only. Attaches a template to a product, merging template field
 *       defaults with optional attribute overrides. Required before approval.
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
 *             required: [templateId]
 *             properties:
 *               templateId: { type: string, format: uuid }
 *               attributes:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: Template attached successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Product or template not found
 */
productRouter.post(
  "/:id/attach-template",
  authenticate,
  authorizePermission(permissions.products.approve),
  validate({
    params: productIdParamSchema,
    body: attachTemplateBodySchema,
  }),
  productController.attachTemplate,
);

/**
 * @openapi
 * /api/v1/products/{id}/reject:
 *   post:
 *     tags: [Products]
 *     summary: Reject a product
 *     description: |
 *       Admin only. Transitions product from `PENDING_APPROVAL` to `REJECTED`.
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
 *                 example: Incomplete product documentation
 *     responses:
 *       200:
 *         description: Product rejected successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Product not found
 *       409:
 *         description: Invalid state transition
 */
productRouter.post(
  "/:id/reject",
  authenticate,
  authorizePermission(permissions.products.reject),
  validate({
    params: productIdParamSchema,
    body: rejectProductBodySchema,
  }),
  productController.rejectProduct,
);

/**
 * @openapi
 * /api/v1/products/{productId}/reviews:
 *   get:
 *     tags: [Products, Reviews]
 *     summary: List product reviews
 *     description: |
 *       Public endpoint. Returns paginated active reviews for an approved marketplace product.
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
 *     responses:
 *       200:
 *         description: Product reviews fetched successfully
 *       404:
 *         description: Product not found
 */
productRouter.get(
  "/:productId/reviews",
  validate({
    params: productReviewsParamSchema,
    query: listProductReviewsQuerySchema,
  }),
  reviewController.listProductReviews,
);

/**
 * @openapi
 * /api/v1/products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get marketplace product details
 *     description: |
 *       Public endpoint. Returns approved product details visible in the marketplace.
 *       Returns 404 for non-approved, disabled, or unavailable products.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Product fetched successfully }
 *                 data:
 *                   $ref: '#/components/schemas/ProductDetail'
 *       400:
 *         description: Invalid product ID
 *       404:
 *         description: Product not found
 */
productRouter.get(
  "/:id",
  validate({ params: productIdParamSchema }),
  productController.getMarketplaceProductById,
);

/**
 * @openapi
 * components:
 *   schemas:
 *     PaginationMeta:
 *       type: object
 *       properties:
 *         page: { type: integer, example: 1 }
 *         limit: { type: integer, example: 20 }
 *         total: { type: integer, example: 250 }
 *         totalPages: { type: integer, example: 13 }
 *     ProductCategorySummary:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string, example: Diagnostic Imaging }
 *         isPrimary: { type: boolean, example: true }
 *     ProductTemplateSummary:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string, example: Portable Ultrasound Template }
 *     ProductSellerSummary:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessName: { type: string, example: MedEquip Solutions }
 *     ProductMedia:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         fileUrl: { type: string }
 *         displayOrder: { type: integer, example: 0 }
 *         createdAt: { type: string, format: date-time }
 *     ProductDocument:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         fileUrl: { type: string }
 *         documentType: { type: string, example: manual }
 *         createdAt: { type: string, format: date-time }
 *     ProductInventorySummary:
 *       type: object
 *       properties:
 *         availableQuantity: { type: integer, example: 25 }
 *     ProductAttributeField:
 *       type: object
 *       properties:
 *         key: { type: string, example: color }
 *         label: { type: string, example: Color }
 *         fieldType:
 *           type: string
 *           enum: [TEXT, NUMBER, BOOLEAN, SELECT, MULTISELECT, DATE]
 *         unit: { type: string, nullable: true }
 *         value: {}
 *         isOrphan: { type: boolean }
 *     ProductListItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         sellerId: { type: string, format: uuid }
 *         templateId: { type: string, format: uuid, nullable: true }
 *         productName: { type: string, example: Portable Ultrasound Scanner }
 *         brand: { type: string, example: Siemens }
 *         model: { type: string, example: ACUSON P500 }
 *         pricing: { type: string, example: "125000.00" }
 *         moq: { type: integer, example: 1 }
 *         status:
 *           type: string
 *           enum: [PENDING_APPROVAL, APPROVED, REJECTED, DISABLED, OUT_OF_STOCK]
 *         categories:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductCategorySummary'
 *         primaryCategory:
 *           $ref: '#/components/schemas/ProductCategorySummary'
 *         template:
 *           allOf:
 *             - $ref: '#/components/schemas/ProductTemplateSummary'
 *             - nullable: true
 *         seller:
 *           $ref: '#/components/schemas/ProductSellerSummary'
 *         primaryImageUrl: { type: string, nullable: true }
 *         averageRating: { type: string, nullable: true, example: "4.5" }
 *         reviewCount: { type: integer, example: 12 }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     ProductDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/ProductListItem'
 *         - type: object
 *           properties:
 *             description: { type: string }
 *             details: { type: string, nullable: true }
 *             attributes:
 *               type: object
 *               nullable: true
 *               additionalProperties: true
 *             attributeFields:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProductAttributeField'
 *             media:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProductMedia'
 *             documents:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProductDocument'
 *             inventory:
 *               $ref: '#/components/schemas/ProductInventorySummary'
 *     ProductCompareItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         productName: { type: string }
 *         categories:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductCategorySummary'
 *         brand: { type: string }
 *         model: { type: string }
 *         pricing: { type: string }
 *         moq: { type: integer }
 *         attributes:
 *           type: object
 *           nullable: true
 *           additionalProperties: true
 *         primaryImageUrl: { type: string, nullable: true }
 *     ProductCompareAttribute:
 *       type: object
 *       properties:
 *         key: { type: string, example: productName }
 *         label: { type: string, example: Product Name }
 *         values:
 *           type: array
 *           items:
 *             oneOf:
 *               - { type: string }
 *               - { type: number }
 *               - { type: "null" }
 *     ProductCompare:
 *       type: object
 *       description: |
 *         Side-by-side comparison payload. `attributes` starts with core commerce
 *         rows, then the union of template attribute keys across selected products
 *         (keys present on 2+ products first, then product-specific keys). Missing
 *         values are `null`.
 *       properties:
 *         productIds:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *         products:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductCompareItem'
 *         attributes:
 *           type: array
 *           description: |
 *             Core rows (productName, categories, brand, model, pricing, moq)
 *             followed by dynamic attribute rows — shared keys first, then
 *             product-specific keys. Value arrays align to `productIds` order.
 *           items:
 *             $ref: '#/components/schemas/ProductCompareAttribute'
 *     CreateProductRequest:
 *       type: object
 *       required:
 *         - categoryIds
 *         - productName
 *         - brand
 *         - model
 *         - pricing
 *         - moq
 *         - description
 *       properties:
 *         categoryIds:
 *           type: array
 *           minItems: 1
 *           items: { type: string, format: uuid }
 *         templateId: { type: string, format: uuid }
 *         productName: { type: string, maxLength: 200 }
 *         brand: { type: string, maxLength: 120 }
 *         model: { type: string, maxLength: 120 }
 *         pricing: { type: string, example: "125000.00" }
 *         moq: { type: integer, minimum: 1 }
 *         description: { type: string, maxLength: 5000 }
 *         details: { type: string, maxLength: 10000 }
 *         attributes:
 *           type: object
 *           additionalProperties: true
 *     UpdateProductRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         categoryIds:
 *           type: array
 *           minItems: 1
 *           items: { type: string, format: uuid }
 *         templateId: { type: string, format: uuid, nullable: true }
 *         productName: { type: string, maxLength: 200 }
 *         brand: { type: string, maxLength: 120 }
 *         model: { type: string, maxLength: 120 }
 *         pricing: { type: string, example: "125000.00" }
 *         moq: { type: integer, minimum: 1 }
 *         description: { type: string, maxLength: 5000 }
 *         details: { type: string, nullable: true, maxLength: 10000 }
 *         attributes:
 *           type: object
 *           nullable: true
 *           additionalProperties: true
 */