import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as controller from "../controllers/marketplaceTeaser.controller.js";
import {
  createTeaserBodySchema,
  listPublicTeasersQuerySchema,
  listTeasersQuerySchema,
  teaserIdParamSchema,
  updateTeaserBodySchema,
} from "../validators/marketplaceTeaser.schemas.js";

export const marketplaceTeaserRouter = Router();

marketplaceTeaserRouter.get(
  "/",
  validate({ query: listPublicTeasersQuerySchema }),
  controller.listPublicTeasers,
);

marketplaceTeaserRouter.get(
  "/admin",
  authenticate,
  authorizePermission(permissions.marketplaceTeasers.read),
  validate({ query: listTeasersQuerySchema }),
  controller.listAdminTeasers,
);

marketplaceTeaserRouter.get(
  "/admin/:id",
  authenticate,
  authorizePermission(permissions.marketplaceTeasers.read),
  validate({ params: teaserIdParamSchema }),
  controller.getAdminTeaser,
);

marketplaceTeaserRouter.post(
  "/admin",
  authenticate,
  authorizePermission(permissions.marketplaceTeasers.manage),
  validate({ body: createTeaserBodySchema }),
  controller.createTeaser,
);

marketplaceTeaserRouter.patch(
  "/admin/:id",
  authenticate,
  authorizePermission(permissions.marketplaceTeasers.manage),
  validate({
    params: teaserIdParamSchema,
    body: updateTeaserBodySchema,
  }),
  controller.updateTeaser,
);

marketplaceTeaserRouter.delete(
  "/admin/:id",
  authenticate,
  authorizePermission(permissions.marketplaceTeasers.manage),
  validate({ params: teaserIdParamSchema }),
  controller.deleteTeaser,
);
