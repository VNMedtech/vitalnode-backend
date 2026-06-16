import { prisma } from "../../../infrastructure/prisma/client.js";
import { NotFoundError } from "../../../shared/errors/app.errors.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { toNotificationDto } from "../dto/notification.dto.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import type {
  ListNotificationsQuery,
  NotificationDto,
  UnreadCountDto,
} from "../types/notification.types.js";

export class NotificationService {
  private readonly repo = new NotificationRepository(prisma);

  async listForUser(
    userId: string,
    query: ListNotificationsQuery,
  ): Promise<{
    items: NotificationDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const [records, total] = await Promise.all([
      this.repo.findManyPaginated({ userId, ...query }),
      this.repo.count({
        userId,
        isRead: query.isRead,
        type: query.type,
      }),
    ]);

    return {
      items: records.map(toNotificationDto),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getUnreadCount(userId: string): Promise<UnreadCountDto> {
    const count = await this.repo.countUnread(userId);
    return { count };
  }

  async markAsRead(userId: string, notificationId: string): Promise<NotificationDto> {
    const existing = await this.repo.findByIdForUser(notificationId, userId);
    if (!existing) {
      throw new NotFoundError("Notification not found");
    }

    if (!existing.isRead) {
      await this.repo.markAsRead(notificationId, userId);
    }

    const updated = await this.repo.findByIdForUser(notificationId, userId);
    if (!updated) {
      throw new NotFoundError("Notification not found");
    }

    return toNotificationDto(updated);
  }

  async markAllAsRead(userId: string): Promise<UnreadCountDto> {
    await this.repo.markAllAsRead(userId);
    return { count: 0 };
  }
}
