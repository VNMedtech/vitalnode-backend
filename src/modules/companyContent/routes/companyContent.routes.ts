import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as controller from "../controllers/companyContent.controller.js";
import {
  createMemberBodySchema,
  listMembersQuerySchema,
  memberIdParamSchema,
  updateMemberBodySchema,
  updateWhyBodySchema,
} from "../validators/companyContent.schemas.js";

export const companyContentRouter = Router();

companyContentRouter.get("/why-vitalnode", controller.getPublicWhy);
companyContentRouter.get(
  "/members",
  validate({ query: listMembersQuerySchema }),
  controller.listPublicMembers,
);

companyContentRouter.get(
  "/admin/why-vitalnode",
  authenticate,
  authorizePermission(permissions.companyContent.read),
  controller.getAdminWhy,
);

companyContentRouter.put(
  "/admin/why-vitalnode",
  authenticate,
  authorizePermission(permissions.companyContent.manage),
  validate({ body: updateWhyBodySchema }),
  controller.updateWhy,
);

companyContentRouter.get(
  "/admin/members",
  authenticate,
  authorizePermission(permissions.companyContent.read),
  validate({ query: listMembersQuerySchema }),
  controller.listAdminMembers,
);

companyContentRouter.post(
  "/admin/members",
  authenticate,
  authorizePermission(permissions.companyContent.manage),
  validate({ body: createMemberBodySchema }),
  controller.createMember,
);

companyContentRouter.patch(
  "/admin/members/:id",
  authenticate,
  authorizePermission(permissions.companyContent.manage),
  validate({
    params: memberIdParamSchema,
    body: updateMemberBodySchema,
  }),
  controller.updateMember,
);

companyContentRouter.delete(
  "/admin/members/:id",
  authenticate,
  authorizePermission(permissions.companyContent.manage),
  validate({ params: memberIdParamSchema }),
  controller.deleteMember,
);
