/**
 * @openapi
 * tags:
 *   - name: Sub Admins
 *     description: Super-admin onboarding of sub-admins with module-level access
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as subAdminController from "../controllers/subAdmin.controller.js";
import { createSubAdminBodySchema } from "../validators/createSubAdmin.schema.js";
import {
  disableSubAdminBodySchema,
  enableSubAdminBodySchema,
} from "../validators/disableEnableSubAdmin.schema.js";
import { listSubAdminsQuerySchema } from "../validators/listSubAdminsQuery.schema.js";
import { subAdminIdParamSchema } from "../validators/subAdminParams.schema.js";
import { updateSubAdminBodySchema } from "../validators/updateSubAdmin.schema.js";

export const subAdminRouter = Router();

/**
 * @openapi
 * /api/v1/admin/sub-admins/modules:
 *   get:
 *     tags: [Sub Admins]
 *     summary: List assignable admin modules
 *     security:
 *       - bearerAuth: []
 */
subAdminRouter.get(
  "/modules",
  authenticate,
  authorizePermission(permissions.admin.manage),
  subAdminController.listModules,
);

/**
 * @openapi
 * /api/v1/admin/sub-admins:
 *   get:
 *     tags: [Sub Admins]
 *     summary: List sub-admins
 *     security:
 *       - bearerAuth: []
 */
subAdminRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.admin.manage),
  validate({ query: listSubAdminsQuerySchema }),
  subAdminController.listSubAdmins,
);

/**
 * @openapi
 * /api/v1/admin/sub-admins:
 *   post:
 *     tags: [Sub Admins]
 *     summary: Onboard a sub-admin
 *     security:
 *       - bearerAuth: []
 */
subAdminRouter.post(
  "/",
  authenticate,
  authorizePermission(permissions.admin.manage),
  validate({ body: createSubAdminBodySchema }),
  subAdminController.createSubAdmin,
);

/**
 * @openapi
 * /api/v1/admin/sub-admins/{id}:
 *   get:
 *     tags: [Sub Admins]
 *     summary: Get sub-admin details
 *     security:
 *       - bearerAuth: []
 */
subAdminRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.admin.manage),
  validate({ params: subAdminIdParamSchema }),
  subAdminController.getSubAdminById,
);

/**
 * @openapi
 * /api/v1/admin/sub-admins/{id}:
 *   patch:
 *     tags: [Sub Admins]
 *     summary: Update sub-admin profile or modules
 *     security:
 *       - bearerAuth: []
 */
subAdminRouter.patch(
  "/:id",
  authenticate,
  authorizePermission(permissions.admin.manage),
  validate({ params: subAdminIdParamSchema, body: updateSubAdminBodySchema }),
  subAdminController.updateSubAdmin,
);

/**
 * @openapi
 * /api/v1/admin/sub-admins/{id}/disable:
 *   patch:
 *     tags: [Sub Admins]
 *     summary: Disable a sub-admin
 *     security:
 *       - bearerAuth: []
 */
subAdminRouter.patch(
  "/:id/disable",
  authenticate,
  authorizePermission(permissions.admin.manage),
  validate({ params: subAdminIdParamSchema, body: disableSubAdminBodySchema }),
  subAdminController.disableSubAdmin,
);

/**
 * @openapi
 * /api/v1/admin/sub-admins/{id}/enable:
 *   patch:
 *     tags: [Sub Admins]
 *     summary: Enable a sub-admin
 *     security:
 *       - bearerAuth: []
 */
subAdminRouter.patch(
  "/:id/enable",
  authenticate,
  authorizePermission(permissions.admin.manage),
  validate({ params: subAdminIdParamSchema, body: enableSubAdminBodySchema }),
  subAdminController.enableSubAdmin,
);

/**
 * @openapi
 * /api/v1/admin/sub-admins/{id}:
 *   delete:
 *     tags: [Sub Admins]
 *     summary: Soft-delete a sub-admin
 *     security:
 *       - bearerAuth: []
 */
subAdminRouter.delete(
  "/:id",
  authenticate,
  authorizePermission(permissions.admin.manage),
  validate({ params: subAdminIdParamSchema }),
  subAdminController.deleteSubAdmin,
);
