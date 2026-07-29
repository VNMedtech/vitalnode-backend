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

  /**
   * Hard-deletes read notifications past retention.
   * Loops a few batches per sweep so large backlogs drain without unbounded work.
   */
  async deleteReadOlderThan(options?: {
    olderThan?: Date;
    ttlDays?: number;
    batchSize?: number;
    maxIterations?: number;
  }): Promise<{ deleted: number }> {
    const ttlDays = options?.ttlDays ?? 30;
    const olderThan =
      options?.olderThan ??
      new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);
    const batchSize = options?.batchSize ?? 500;
    const maxIterations = options?.maxIterations ?? 10;

    let deleted = 0;

    for (let i = 0; i < maxIterations; i += 1) {
      const result = await this.repo.deleteReadOlderThan({
        olderThan,
        limit: batchSize,
      });
      deleted += result.deleted;

      if (result.deleted < batchSize) {
        break;
      }
    }

    return { deleted };
  }
}
