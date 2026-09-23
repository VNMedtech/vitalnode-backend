/**
 * admin — admin.routes
 * Express router definitions and middleware wiring.
 */
import { Router } from "express";
import {
  adminSellerCommissionRouter,
  adminSettlementRouter,
} from "../../settlements/routes/adminSettlement.routes.js";
import { adminUserRouter } from "./adminUser.routes.js";
import { subAdminRouter } from "./subAdmin.routes.js";
import { adminInvoiceRouter } from "../../invoices/routes/adminInvoice.routes.js";

export const adminRouter = Router();

adminRouter.use("/users", adminUserRouter);
adminRouter.use("/sub-admins", subAdminRouter);
adminRouter.use("/invoices", adminInvoiceRouter);
adminRouter.use("/sellers", adminSellerCommissionRouter);
adminRouter.use("/settlements", adminSettlementRouter);
