/**
 * @openapi
 * tags:
 *   - name: Products
 *     description: Product catalog, seller management, and admin approval workflows
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as productController from "../controllers/product.controller.js";
import { productFileUpload } from "../middleware/productUpload.middleware.js";
import {
  createProductMultipartBodySchema,
  updateProductMultipartBodySchema,
} from "../validators/productMultipart.schema.js";
import { productIdParamSchema } from "../validators/productParams.schema.js";
import {
  listMarketplaceProductsQuerySchema,
  listOwnProductsQuerySchema,
  listPendingProductsQuerySchema,
} from "../validators/query.schema.js";
import { rejectProductBodySchema } from "../validators/rejectProduct.schema.js";
import { compareProductsQuerySchema } from "../validators/compareProducts.schema.js";

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
 *           enum: [price, newest, deliveryTime]
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
 *         description: Case-insensitive search across product name, brand, and model
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
 *       Returns comparison attributes aligned to the requested product order.
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
 *         description: Repeat the parameter for each product ID (e.g. `?productIds=uuid1&productIds=uuid2`)
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
 *         description: Validation failed
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
 *           enum: [price, newest, deliveryTime]
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
 *       Seller only. Creates a product in `PENDING_APPROVAL` status.
 *       Only approved sellers may create products. Category must exist and be active.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProductRequest'
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
 *         description: Category not found
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
 *           enum: [price, newest, deliveryTime]
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
 * /api/v1/products/{id}:
 *   patch:
 *     tags: [Products]
 *     summary: Update a product
 *     description: |
 *       Seller only. Updates a product owned by the authenticated seller.
 *       Edits after approval do not require re-approval.
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
 *             $ref: '#/components/schemas/UpdateProductRequest'
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
 *         description: Product approved successfully
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
 *     ProductListItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         sellerId: { type: string, format: uuid }
 *         categoryId: { type: string, format: uuid }
 *         productName: { type: string, example: Portable Ultrasound Scanner }
 *         brand: { type: string, example: Siemens }
 *         model: { type: string, example: ACUSON P500 }
 *         productType: { type: string, example: Diagnostic Device }
 *         pricing: { type: string, example: "125000.00" }
 *         moq: { type: integer, example: 1 }
 *         deliveryTime: { type: integer, nullable: true, example: 7 }
 *         status:
 *           type: string
 *           enum: [PENDING_APPROVAL, APPROVED, REJECTED, DISABLED, OUT_OF_STOCK]
 *         category:
 *           $ref: '#/components/schemas/ProductCategorySummary'
 *         seller:
 *           $ref: '#/components/schemas/ProductSellerSummary'
 *         primaryImageUrl: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     ProductDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/ProductListItem'
 *         - type: object
 *           properties:
 *             color: { type: string, nullable: true }
 *             weight: { type: string, nullable: true, example: "12.50" }
 *             length: { type: string, nullable: true, example: "45.00" }
 *             warrantyPeriod: { type: integer, nullable: true, example: 24 }
 *             returnTime: { type: integer, nullable: true, example: 14 }
 *             description: { type: string }
 *             details: { type: string, nullable: true }
 *             specifications:
 *               type: object
 *               nullable: true
 *               additionalProperties: true
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
 *         productName: { type: string, example: Portable Ultrasound Scanner }
 *         category:
 *           $ref: '#/components/schemas/ProductCategorySummary'
 *         brand: { type: string, example: Siemens }
 *         model: { type: string, example: ACUSON P500 }
 *         productType: { type: string, example: Diagnostic Device }
 *         color: { type: string, nullable: true, example: White }
 *         weight: { type: string, nullable: true, example: "12.50" }
 *         length: { type: string, nullable: true, example: "45.00" }
 *         warrantyPeriod: { type: integer, nullable: true, example: 24 }
 *         returnTime: { type: integer, nullable: true, example: 14 }
 *         deliveryTime: { type: integer, nullable: true, example: 7 }
 *         pricing: { type: string, example: "125000.00" }
 *         moq: { type: integer, example: 1 }
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
 *           items:
 *             $ref: '#/components/schemas/ProductCompareAttribute'
 *     CreateProductRequest:
 *       type: object
 *       required:
 *         - categoryId
 *         - productName
 *         - brand
 *         - model
 *         - productType
 *         - pricing
 *         - moq
 *         - description
 *       properties:
 *         categoryId: { type: string, format: uuid }
 *         productName: { type: string, maxLength: 200 }
 *         brand: { type: string, maxLength: 120 }
 *         model: { type: string, maxLength: 120 }
 *         productType: { type: string, maxLength: 120 }
 *         color: { type: string, maxLength: 60 }
 *         weight: { type: string, example: "12.50" }
 *         length: { type: string, example: "45.00" }
 *         warrantyPeriod: { type: integer, minimum: 0 }
 *         returnTime: { type: integer, minimum: 0 }
 *         deliveryTime: { type: integer, minimum: 0 }
 *         pricing: { type: string, example: "125000.00" }
 *         moq: { type: integer, minimum: 1 }
 *         description: { type: string, maxLength: 5000 }
 *         details: { type: string, maxLength: 10000 }
 *         specifications:
 *           type: object
 *           additionalProperties: true
 *         media:
 *           type: array
 *           items:
 *             type: object
 *             required: [fileUrl]
 *             properties:
 *               fileUrl: { type: string, format: uri }
 *               displayOrder: { type: integer, minimum: 0 }
 *         documents:
 *           type: array
 *           items:
 *             type: object
 *             required: [fileUrl, documentType]
 *             properties:
 *               fileUrl: { type: string, format: uri }
 *               documentType: { type: string, maxLength: 120 }
 *     UpdateProductRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         categoryId: { type: string, format: uuid }
 *         productName: { type: string, maxLength: 200 }
 *         brand: { type: string, maxLength: 120 }
 *         model: { type: string, maxLength: 120 }
 *         productType: { type: string, maxLength: 120 }
 *         color: { type: string, nullable: true, maxLength: 60 }
 *         weight: { type: string, nullable: true }
 *         length: { type: string, nullable: true }
 *         warrantyPeriod: { type: integer, nullable: true, minimum: 0 }
 *         returnTime: { type: integer, nullable: true, minimum: 0 }
 *         deliveryTime: { type: integer, nullable: true, minimum: 0 }
 *         pricing: { type: string, example: "125000.00" }
 *         moq: { type: integer, minimum: 1 }
 *         description: { type: string, maxLength: 5000 }
 *         details: { type: string, nullable: true, maxLength: 10000 }
 *         specifications:
 *           type: object
 *           nullable: true
 *           additionalProperties: true
 *         media:
 *           type: array
 *           items:
 *             type: object
 *             required: [fileUrl]
 *             properties:
 *               fileUrl: { type: string, format: uri }
 *               displayOrder: { type: integer, minimum: 0 }
 *         documents:
 *           type: array
 *           items:
 *             type: object
 *             required: [fileUrl, documentType]
 *             properties:
 *               fileUrl: { type: string, format: uri }
 *               documentType: { type: string, maxLength: 120 }
 */
