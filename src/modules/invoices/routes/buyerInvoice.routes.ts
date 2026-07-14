/**
 * @openapi
 * tags:
 *   - name: Invoices
 *     description: Buyer invoice listing and retrieval
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as buyerInvoiceController from "../controllers/buyerInvoice.controller.js";
import {
  invoiceIdParamSchema,
  listInvoicesQuerySchema,
  orderIdInvoiceParamSchema,
} from "../validators/invoice.schema.js";

export const buyerInvoiceRouter = Router();

/**
 * @openapi
 * /api/v1/buyers/invoices:
 *   get:
 *     tags: [Invoices]
 *     summary: List buyer invoices
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
 *         description: Forbidden
 */
buyerInvoiceRouter.get(
  "/invoices",
  authenticate,
  authorizePermission(permissions.invoices.read),
  validate({ query: listInvoicesQuerySchema }),
  buyerInvoiceController.listBuyerInvoices,
);

/**
 * @openapi
 * /api/v1/buyers/invoices/{id}:
 *   get:
 *     tags: [Invoices]
 *     summary: Get a buyer invoice by id
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
buyerInvoiceRouter.get(
  "/invoices/:id",
  authenticate,
  authorizePermission(permissions.invoices.read),
  validate({ params: invoiceIdParamSchema }),
  buyerInvoiceController.getBuyerInvoiceById,
);

/**
 * @openapi
 * /api/v1/buyers/orders/{orderId}/invoice:
 *   get:
 *     tags: [Invoices]
 *     summary: Get invoice for a buyer order
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Invoice fetched successfully
 *       404:
 *         description: Invoice not found
 */
buyerInvoiceRouter.get(
  "/orders/:orderId/invoice",
  authenticate,
  authorizePermission(permissions.invoices.read),
  validate({ params: orderIdInvoiceParamSchema }),
  buyerInvoiceController.getBuyerInvoiceByOrderId,
);
