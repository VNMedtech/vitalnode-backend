import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  requireApprovedSeller,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as sellerSettlementController from "../controllers/sellerSettlement.controller.js";
import {
  listSettlementsQuerySchema,
  settlementIdParamSchema,
} from "../validators/settlement.schema.js";

export const sellerEarningsRouter = Router();

sellerEarningsRouter.get(
  "/summary",
  authenticate,
  authorizePermission(permissions.settlements.read),
  requireApprovedSeller,
  sellerSettlementController.getSellerEarningsSummary,
);

export const sellerSettlementRouter = Router();

sellerSettlementRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.settlements.read),
  requireApprovedSeller,
  validate({ query: listSettlementsQuerySchema }),
  sellerSettlementController.listSellerSettlements,
);

sellerSettlementRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.settlements.read),
  requireApprovedSeller,
  validate({ params: settlementIdParamSchema }),
  sellerSettlementController.getSellerSettlementById,
);
