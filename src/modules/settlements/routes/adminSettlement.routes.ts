import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import { updateSellerCommissionBodySchema } from "../../sellers/validators/approveSeller.schema.js";
import { sellerIdParamSchema } from "../../sellers/validators/sellerParams.schema.js";
import * as adminSettlementController from "../controllers/adminSettlement.controller.js";
import {
  createSettlementBatchBodySchema,
  disburseSettlementBatchBodySchema,
  listSettlementsQuerySchema,
  settlementIdParamSchema,
  settlementSellerIdParamSchema,
} from "../validators/settlement.schema.js";

export const adminSettlementRouter = Router();

adminSettlementRouter.get(
  "/pending",
  authenticate,
  authorizePermission(permissions.settlements.manage),
  adminSettlementController.listPendingSettlements,
);

adminSettlementRouter.get(
  "/seller/:sellerId",
  authenticate,
  authorizePermission(permissions.settlements.manage),
  validate({ params: settlementSellerIdParamSchema }),
  adminSettlementController.getSellerPendingSettlementDetail,
);

adminSettlementRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.settlements.manage),
  validate({ query: listSettlementsQuerySchema }),
  adminSettlementController.listSettlementHistory,
);

adminSettlementRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.settlements.manage),
  validate({ params: settlementIdParamSchema }),
  adminSettlementController.getSettlementBatchById,
);

adminSettlementRouter.post(
  "/",
  authenticate,
  authorizePermission(permissions.settlements.manage),
  validate({ body: createSettlementBatchBodySchema }),
  adminSettlementController.createSettlementBatch,
);

adminSettlementRouter.patch(
  "/:id/disburse",
  authenticate,
  authorizePermission(permissions.settlements.manage),
  validate({
    params: settlementIdParamSchema,
    body: disburseSettlementBatchBodySchema,
  }),
  adminSettlementController.disburseSettlementBatch,
);

export const adminSellerCommissionRouter = Router();

adminSellerCommissionRouter.patch(
  "/:id/commission",
  authenticate,
  authorizePermission(permissions.settlements.manage),
  validate({
    params: sellerIdParamSchema,
    body: updateSellerCommissionBodySchema,
  }),
  adminSettlementController.updateSellerCommission,
);
