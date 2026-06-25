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

buyerInvoiceRouter.get(
  "/invoices",
  authenticate,
  authorizePermission(permissions.invoices.read),
  validate({ query: listInvoicesQuerySchema }),
  buyerInvoiceController.listBuyerInvoices,
);

buyerInvoiceRouter.get(
  "/invoices/:id",
  authenticate,
  authorizePermission(permissions.invoices.read),
  validate({ params: invoiceIdParamSchema }),
  buyerInvoiceController.getBuyerInvoiceById,
);

buyerInvoiceRouter.get(
  "/orders/:orderId/invoice",
  authenticate,
  authorizePermission(permissions.invoices.read),
  validate({ params: orderIdInvoiceParamSchema }),
  buyerInvoiceController.getBuyerInvoiceByOrderId,
);
