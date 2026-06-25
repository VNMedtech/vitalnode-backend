/**
 * @openapi
 * tags:
 *   - name: Admin Users
 *     description: Admin user management — list, inspect, update, enable/disable, and soft-delete platform users
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as adminUserController from "../controllers/adminUser.controller.js";
import { adminUserIdParamSchema } from "../validators/adminUserParams.schema.js";
import {
  disableAdminUserBodySchema,
  enableAdminUserBodySchema,
} from "../validators/disableEnableAdminUser.schema.js";
import { listAdminUsersQuerySchema } from "../validators/listAdminUsersQuery.schema.js";
import { updateAdminUserBodySchema } from "../validators/updateAdminUser.schema.js";

export const adminUserRouter = Router();

/**
 * @openapi
 * /api/v1/admin/users/stats:
 *   get:
 *     tags: [Admin Users]
 *     summary: User statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform user counts by role and status
 */
adminUserRouter.get(
  "/stats",
  authenticate,
  authorizePermission(permissions.users.stats),
  adminUserController.getAdminUserStats,
);

/**
 * @openapi
 * /api/v1/admin/users:
 *   get:
 *     tags: [Admin Users]
 *     summary: List users
 *     security:
 *       - bearerAuth: []
 */
adminUserRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.users.list),
  validate({ query: listAdminUsersQuerySchema }),
  adminUserController.listAdminUsers,
);

/**
 * @openapi
 * /api/v1/admin/users/{id}:
 *   get:
 *     tags: [Admin Users]
 *     summary: User details
 *     security:
 *       - bearerAuth: []
 */
adminUserRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.users.read),
  validate({ params: adminUserIdParamSchema }),
  adminUserController.getAdminUserById,
);

/**
 * @openapi
 * /api/v1/admin/users/{id}/activity:
 *   get:
 *     tags: [Admin Users]
 *     summary: User activity
 *     security:
 *       - bearerAuth: []
 */
adminUserRouter.get(
  "/:id/activity",
  authenticate,
  authorizePermission(permissions.users.activity),
  validate({ params: adminUserIdParamSchema }),
  adminUserController.getAdminUserActivity,
);

/**
 * @openapi
 * /api/v1/admin/users/{id}:
 *   patch:
 *     tags: [Admin Users]
 *     summary: Update user
 *     security:
 *       - bearerAuth: []
 */
adminUserRouter.patch(
  "/:id",
  authenticate,
  authorizePermission(permissions.users.update),
  validate({ params: adminUserIdParamSchema, body: updateAdminUserBodySchema }),
  adminUserController.updateAdminUser,
);

/**
 * @openapi
 * /api/v1/admin/users/{id}/disable:
 *   patch:
 *     tags: [Admin Users]
 *     summary: Disable user
 *     security:
 *       - bearerAuth: []
 */
adminUserRouter.patch(
  "/:id/disable",
  authenticate,
  authorizePermission(permissions.users.disable),
  validate({ params: adminUserIdParamSchema, body: disableAdminUserBodySchema }),
  adminUserController.disableAdminUser,
);

/**
 * @openapi
 * /api/v1/admin/users/{id}/enable:
 *   patch:
 *     tags: [Admin Users]
 *     summary: Enable user
 *     security:
 *       - bearerAuth: []
 */
adminUserRouter.patch(
  "/:id/enable",
  authenticate,
  authorizePermission(permissions.users.enable),
  validate({ params: adminUserIdParamSchema, body: enableAdminUserBodySchema }),
  adminUserController.enableAdminUser,
);

/**
 * @openapi
 * /api/v1/admin/users/{id}:
 *   delete:
 *     tags: [Admin Users]
 *     summary: Soft delete user
 *     security:
 *       - bearerAuth: []
 */
adminUserRouter.delete(
  "/:id",
  authenticate,
  authorizePermission(permissions.users.delete),
  validate({ params: adminUserIdParamSchema }),
  adminUserController.deleteAdminUser,
);
