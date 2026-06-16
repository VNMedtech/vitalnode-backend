import type { NotificationSortField } from "../constants/notification.constants.js";

export interface NotificationDto {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListNotificationsQuery {
  page: number;
  limit: number;
  sortBy: NotificationSortField;
  sortOrder: "asc" | "desc";
  isRead?: boolean;
  type?: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
}

export interface UnreadCountDto {
  count: number;
}
