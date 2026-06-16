import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { NotificationService } from "../services/notification.service.js";
import type { NotificationIdParam } from "../validators/notificationParams.schema.js";
import type { ListNotificationsQueryInput } from "../validators/query.schema.js";

const notificationService = new NotificationService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const listNotifications: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const query = req.query as unknown as ListNotificationsQueryInput;
    const result = await notificationService.listForUser(userId, query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Notifications fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const getUnreadCount: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const result = await notificationService.getUnreadCount(userId);
    res
      .status(200)
      .json(successResponse(result, "Unread count fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const markNotificationAsRead: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const { id } = req.params as NotificationIdParam;
    const notification = await notificationService.markAsRead(userId, id);
    res
      .status(200)
      .json(successResponse(notification, "Notification marked as read"));
  } catch (err) {
    next(err);
  }
};

export const markAllNotificationsAsRead: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const result = await notificationService.markAllAsRead(userId);
    res
      .status(200)
      .json(successResponse(result, "All notifications marked as read"));
  } catch (err) {
    next(err);
  }
};
