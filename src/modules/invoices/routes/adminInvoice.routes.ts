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

adminInvoiceRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.invoices.read),
  validate({ query: listInvoicesQuerySchema }),
  adminInvoiceController.listAdminInvoices,
);

adminInvoiceRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.invoices.read),
  validate({ params: invoiceIdParamSchema }),
  adminInvoiceController.getAdminInvoiceById,
);
