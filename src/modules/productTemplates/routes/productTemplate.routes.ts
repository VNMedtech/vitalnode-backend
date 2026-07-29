/**
 * @openapi
 * tags:
 *   - name: Product Templates
 *     description: >
 *       Admin-configurable product blueprints for create-form autofill (base field
 *       snapshot + attribute defaults) and approval gating
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as productTemplateController from "../controllers/productTemplate.controller.js";
import {
  createProductTemplateBodySchema,
  replaceProductTemplateCategoriesBodySchema,
  replaceProductTemplateFieldsBodySchema,
  updateProductTemplateBodySchema,
} from "../validators/createProductTemplate.schema.js";
import {
  listProductTemplatesQuerySchema,
  productTemplateIdParamSchema,
  searchProductTemplatesQuerySchema,
} from "../validators/query.schema.js";

export const productTemplateRouter = Router();

/**
 * @openapi
 * /api/v1/product-templates/search:
 *   get:
 *     tags: [Product Templates]
 *     summary: Search active templates (optional category filter)
 *     description: |
 *       Seller/admin. Returns **active** templates for create/edit form autofill
 *       (`baseDefaults` base-field snapshot + field defaults + linked `categories`).
 *       Without `categoryIds`, searches all active templates (optionally filtered by `q`).
 *       With `categoryIds`, returns templates linked to **any** of those categories (OR).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoryIds
 *         required: false
 *         schema:
 *           type: array
 *           minItems: 1
 *           items: { type: string, format: uuid }
 *         style: form
 *         explode: true
 *         description: >
 *           Optional. When provided (min 1 UUID), OR-match templates linked to any
 *           of these categories. When omitted, return all active templates (filter by `q`).
 *       - in: query
 *         name: q
 *         schema: { type: string, maxLength: 120 }
 *         description: Optional name/description filter
 *     responses:
 *       200:
 *         description: Product templates fetched successfully
 *       400:
 *         description: Validation failed (e.g. empty `categoryIds` or invalid UUID)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
productTemplateRouter.get(
  "/search",
  authenticate,
  authorizePermission(permissions.productTemplates.read),
  validate({ query: searchProductTemplatesQuerySchema }),
  productTemplateController.searchTemplates,
);

/**
 * @openapi
 * /api/v1/product-templates:
 *   get:
 *     tags: [Product Templates]
 *     summary: List product templates
 *     description: Admin list with filters for q, categoryId, and isActive.
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
 *         schema: { type: string, enum: [name, createdAt, updatedAt], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: q
 *         schema: { type: string, maxLength: 120 }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Product templates fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 */
productTemplateRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.productTemplates.manage),
  validate({ query: listProductTemplatesQuerySchema }),
  productTemplateController.listTemplates,
);

/**
 * @openapi
 * /api/v1/product-templates:
 *   post:
 *     tags: [Product Templates]
 *     summary: Create a product template
 *     description: |
 *       Admin only. Creates a configurable blueprint with optional fields,
 *       category links, and optional `baseDefaults` (form-field snapshot for
 *       product create autofill — no images/documents).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProductTemplateRequest'
 *     responses:
 *       201:
 *         description: Product template created successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       409:
 *         description: Template name already exists
 */
productTemplateRouter.post(
  "/",
  authenticate,
  authorizePermission(permissions.productTemplates.manage),
  validate({ body: createProductTemplateBodySchema }),
  productTemplateController.createTemplate,
);

/**
 * @openapi
 * /api/v1/product-templates/{id}:
 *   get:
 *     tags: [Product Templates]
 *     summary: Get product template details
 *     description: Includes fields, categories, and optional `baseDefaults` for create-form autofill.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product template fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Product template not found
 */
productTemplateRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.productTemplates.read),
  validate({ params: productTemplateIdParamSchema }),
  productTemplateController.getTemplateById,
);

/**
 * @openapi
 * /api/v1/product-templates/{id}:
 *   patch:
 *     tags: [Product Templates]
 *     summary: Update a product template
 *     description: |
 *       Admin only. May update `baseDefaults` (set or clear with `null`).
 *       Template edits affect new uses only; existing product attributes are unchanged.
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
 *             $ref: '#/components/schemas/UpdateProductTemplateRequest'
 *     responses:
 *       200:
 *         description: Product template updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Product template not found
 *       409:
 *         description: Template name already exists
 */
productTemplateRouter.patch(
  "/:id",
  authenticate,
  authorizePermission(permissions.productTemplates.manage),
  validate({
    params: productTemplateIdParamSchema,
    body: updateProductTemplateBodySchema,
  }),
  productTemplateController.updateTemplate,
);

/**
 * @openapi
 * /api/v1/product-templates/{id}:
 *   delete:
 *     tags: [Product Templates]
 *     summary: Disable a product template
 *     description: Admin only. Soft-disables the template (isActive=false, deletedAt set).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product template disabled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Product template not found
 */
productTemplateRouter.delete(
  "/:id",
  authenticate,
  authorizePermission(permissions.productTemplates.manage),
  validate({ params: productTemplateIdParamSchema }),
  productTemplateController.disableTemplate,
);

/**
 * @openapi
 * /api/v1/product-templates/{id}/fields:
 *   put:
 *     tags: [Product Templates]
 *     summary: Replace template fields
 *     description: Admin only. Replaces the full configurable field set for the template.
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
 *             required: [fields]
 *             properties:
 *               fields:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ProductTemplateFieldInput'
 *     responses:
 *       200:
 *         description: Product template fields updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Product template not found
 */
productTemplateRouter.put(
  "/:id/fields",
  authenticate,
  authorizePermission(permissions.productTemplates.manage),
  validate({
    params: productTemplateIdParamSchema,
    body: replaceProductTemplateFieldsBodySchema,
  }),
  productTemplateController.replaceFields,
);

/**
 * @openapi
 * /api/v1/product-templates/{id}/categories:
 *   put:
 *     tags: [Product Templates]
 *     summary: Replace template category links
 *     description: Admin only. Replaces category associations used for seller template search.
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
 *             required: [categoryIds]
 *             properties:
 *               categoryIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product template categories updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Product template or category not found
 */
productTemplateRouter.put(
  "/:id/categories",
  authenticate,
  authorizePermission(permissions.productTemplates.manage),
  validate({
    params: productTemplateIdParamSchema,
    body: replaceProductTemplateCategoriesBodySchema,
  }),
  productTemplateController.replaceCategories,
);

/**
 * @openapi
 * components:
 *   schemas:
 *     ProductTemplateBaseDefaults:
 *       type: object
 *       additionalProperties: false
 *       description: |
 *         Snapshot of base product form fields for create-form prefill.
 *         Form fields only — no images/documents. `null`/absent = no base prefill.
 *       properties:
 *         productName: { type: string, example: Dual-Head Stethoscope }
 *         brand: { type: string, example: Littmann }
 *         model: { type: string, example: Classic III }
 *         pricing:
 *           oneOf:
 *             - type: string
 *               example: "8999.00"
 *             - type: number
 *           description: Decimal string (preferred) or number; stored/returned as string
 *         moq: { type: integer, minimum: 1, example: 1 }
 *         description: { type: string }
 *         details: { type: string, nullable: true }
 *     ProductTemplateFieldInput:
 *       type: object
 *       required: [key, label, fieldType]
 *       properties:
 *         key: { type: string, example: color }
 *         label: { type: string, example: Color }
 *         fieldType:
 *           type: string
 *           enum: [TEXT, NUMBER, BOOLEAN, SELECT, MULTISELECT, DATE]
 *         options:
 *           description: Required for SELECT/MULTISELECT
 *           example: ["White", "Black"]
 *         defaultValue: {}
 *         unit: { type: string, nullable: true, example: kg }
 *         sortOrder: { type: integer, minimum: 0 }
 *         isActive: { type: boolean, default: true }
 *     CreateProductTemplateRequest:
 *       type: object
 *       required: [name]
 *       properties:
 *         name: { type: string, maxLength: 120 }
 *         description: { type: string, nullable: true, maxLength: 2000 }
 *         baseDefaults:
 *           allOf:
 *             - $ref: '#/components/schemas/ProductTemplateBaseDefaults'
 *           nullable: true
 *           description: Optional base-field snapshot for product create autofill
 *         isActive: { type: boolean, default: true }
 *         categoryIds:
 *           type: array
 *           items: { type: string, format: uuid }
 *         fields:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductTemplateFieldInput'
 *     UpdateProductTemplateRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         name: { type: string, maxLength: 120 }
 *         description: { type: string, nullable: true, maxLength: 2000 }
 *         baseDefaults:
 *           allOf:
 *             - $ref: '#/components/schemas/ProductTemplateBaseDefaults'
 *           nullable: true
 *           description: Set or clear (`null`) the base-field snapshot
 *         isActive: { type: boolean }
 *         categoryIds:
 *           type: array
 *           items: { type: string, format: uuid }
 *         fields:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductTemplateFieldInput'
 *     ProductTemplateField:
 *       allOf:
 *         - $ref: '#/components/schemas/ProductTemplateFieldInput'
 *         - type: object
 *           properties:
 *             id: { type: string, format: uuid }
 *             createdAt: { type: string, format: date-time }
 *             updatedAt: { type: string, format: date-time }
 *     ProductTemplate:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         baseDefaults:
 *           allOf:
 *             - $ref: '#/components/schemas/ProductTemplateBaseDefaults'
 *           nullable: true
 *         isActive: { type: boolean }
 *         fieldCount:
 *           type: integer
 *           description: Number of active (isActive=true) template fields only; inactive fields are excluded
 *         categories:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid }
 *               name: { type: string }
 *         fields:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductTemplateField'
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */
