import type { Notification } from "../../../../generated/prisma/client.js";
import type { NotificationDto } from "../types/notification.types.js";

export function toNotificationDto(record: Notification): NotificationDto {
  return {
    id: record.id,
    userId: record.userId,
    type: record.type,
    title: record.title,
    message: record.message,
    isRead: record.isRead,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
