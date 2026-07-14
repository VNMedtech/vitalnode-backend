/**
 * @openapi
 * tags:
 *   - name: Admin Invoices
 *     description: Admin invoice listing and retrieval
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as adminInvoiceController from "../controllers/adminInvoice.controller.js";
import {
  invoiceIdParamSchema,
  listInvoicesQuerySchema,
} from "../validators/invoice.schema.js";

export const adminInvoiceRouter = Router();

/**
 * @openapi
 * /api/v1/admin/invoices:
 *   get:
 *     tags: [Admin Invoices]
 *     summary: List all invoices
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
 *           enum: [generatedAt, invoiceNumber, createdAt]
 *           default: generatedAt
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Invoices listed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 */
adminInvoiceRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.invoices.read),
  validate({ query: listInvoicesQuerySchema }),
  adminInvoiceController.listAdminInvoices,
);

/**
 * @openapi
 * /api/v1/admin/invoices/{id}:
 *   get:
 *     tags: [Admin Invoices]
 *     summary: Get an invoice by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Invoice fetched successfully
 *       404:
 *         description: Invoice not found
 */
adminInvoiceRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.invoices.read),
  validate({ params: invoiceIdParamSchema }),
  adminInvoiceController.getAdminInvoiceById,
);
