/**
 * @openapi
 * tags:
 *   - name: Categories
 *     description: Product category management
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as categoryController from "../controllers/category.controller.js";
import { categoryIdParamSchema } from "../validators/categoryParams.schema.js";
import { createCategoryBodySchema } from "../validators/createCategory.schema.js";
import { listCategoriesQuerySchema } from "../validators/query.schema.js";
import { updateCategoryBodySchema } from "../validators/updateCategory.schema.js";

export const categoryRouter = Router();

/**
 * @openapi
 * /api/v1/categories:
 *   get:
 *     tags: [Categories]
 *     summary: List active categories
 *     description: Public endpoint. Returns paginated active, non-deleted categories.
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
 *           enum: [name, createdAt, updatedAt]
 *           default: name
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *       - in: query
 *         name: search
 *         schema: { type: string, maxLength: 120 }
 *         description: Case-insensitive partial match on category name
 *     responses:
 *       200:
 *         description: Categories fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Categories fetched successfully }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page: { type: integer, example: 1 }
 *                     limit: { type: integer, example: 20 }
 *                     total: { type: integer, example: 42 }
 *                     totalPages: { type: integer, example: 3 }
 *       400:
 *         description: Validation failed
 */
categoryRouter.get(
  "/",
  validate({ query: listCategoriesQuerySchema }),
  categoryController.listCategories,
);

/**
 * @openapi
 * /api/v1/categories/{id}:
 *   get:
 *     tags: [Categories]
 *     summary: Get category details
 *     description: Public endpoint. Returns 404 for invalid, inactive, or deleted categories.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Category fetched successfully }
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       400:
 *         description: Invalid category ID
 *       404:
 *         description: Category not found
 */
categoryRouter.get(
  "/:id",
  validate({ params: categoryIdParamSchema }),
  categoryController.getCategoryById,
);

/**
 * @openapi
 * /api/v1/categories:
 *   post:
 *     tags: [Categories]
 *     summary: Create a category
 *     description: Admin only. Category name must be unique.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 120
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       201:
 *         description: Category created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Category created successfully }
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       409:
 *         description: Category name already exists
 */
categoryRouter.post(
  "/",
  authenticate,
  authorizePermission(permissions.categories.create),
  validate({ body: createCategoryBodySchema }),
  categoryController.createCategory,
);

/**
 * @openapi
 * /api/v1/categories/{id}:
 *   patch:
 *     tags: [Categories]
 *     summary: Update a category
 *     description: Admin only. Category name must remain unique.
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
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 120
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Category not found
 *       409:
 *         description: Category name already exists
 */
categoryRouter.patch(
  "/:id",
  authenticate,
  authorizePermission(permissions.categories.update),
  validate({
    params: categoryIdParamSchema,
    body: updateCategoryBodySchema,
  }),
  categoryController.updateCategory,
);

/**
 * @openapi
 * /api/v1/categories/{id}:
 *   delete:
 *     tags: [Categories]
 *     summary: Disable a category
 *     description: |
 *       Admin only. Performs a soft delete by setting `isActive` to false and
 *       recording `deletedAt`. Existing products linked to the category remain intact.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category disabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Category disabled successfully }
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       400:
 *         description: Invalid category ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 *       404:
 *         description: Category not found or already disabled
 */
categoryRouter.delete(
  "/:id",
  authenticate,
  authorizePermission(permissions.categories.delete),
  validate({ params: categoryIdParamSchema }),
  categoryController.disableCategory,
);

/**
 * @openapi
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string, example: Diagnostic Imaging }
 *         description: { type: string, nullable: true, example: MRI and CT equipment }
 *         isActive: { type: boolean, example: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */
