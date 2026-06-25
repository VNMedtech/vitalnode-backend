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

export const adminRouter = Router();

adminRouter.use("/users", adminUserRouter);
adminRouter.use("/sellers", adminSellerCommissionRouter);
adminRouter.use("/settlements", adminSettlementRouter);
