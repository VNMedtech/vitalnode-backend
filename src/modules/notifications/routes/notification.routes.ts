/**
 * @openapi
 * tags:
 *   - name: Notifications
 *     description: In-app notification inbox for authenticated users
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as notificationController from "../controllers/notification.controller.js";
import { notificationIdParamSchema } from "../validators/notificationParams.schema.js";
import { listNotificationsQuerySchema } from "../validators/query.schema.js";

export const notificationRouter = Router();

/**
 * @openapi
 * /api/v1/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List notifications
 *     description: Returns paginated in-app notifications for the authenticated user.
 *     security:
 *       - bearerAuth: []
 */
notificationRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.notifications.read),
  validate({ query: listNotificationsQuerySchema }),
  notificationController.listNotifications,
);

/**
 * @openapi
 * /api/v1/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get unread notification count
 *     security:
 *       - bearerAuth: []
 */
notificationRouter.get(
  "/unread-count",
  authenticate,
  authorizePermission(permissions.notifications.read),
  notificationController.getUnreadCount,
);

/**
 * @openapi
 * /api/v1/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     security:
 *       - bearerAuth: []
 */
notificationRouter.patch(
  "/read-all",
  authenticate,
  authorizePermission(permissions.notifications.read),
  notificationController.markAllNotificationsAsRead,
);

/**
 * @openapi
 * /api/v1/notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark a notification as read
 *     security:
 *       - bearerAuth: []
 */
notificationRouter.patch(
  "/:id/read",
  authenticate,
  authorizePermission(permissions.notifications.read),
  validate({ params: notificationIdParamSchema }),
  notificationController.markNotificationAsRead,
);
