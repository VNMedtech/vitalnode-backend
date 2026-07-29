import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import type { NotificationSortField } from "../constants/notification.constants.js";
import type { CreateNotificationInput } from "../types/notification.types.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface FindNotificationsOptions {
  userId: string;
  page: number;
  limit: number;
  sortBy: NotificationSortField;
  sortOrder: "asc" | "desc";
  isRead?: boolean;
  type?: string;
}

function buildWhere(
  options: Pick<
    FindNotificationsOptions,
    "userId" | "isRead" | "type"
  >,
): Prisma.NotificationWhereInput {
  return {
    userId: options.userId,
    ...(options.isRead !== undefined ? { isRead: options.isRead } : {}),
    ...(options.type ? { type: options.type } : {}),
  };
}

export class NotificationRepository {
  constructor(private readonly db: DbClient) {}

  create(data: CreateNotificationInput) {
    return this.db.notification.create({
      data,
    });
  }

  findByIdForUser(id: string, userId: string) {
    return this.db.notification.findFirst({
      where: { id, userId },
    });
  }

  findManyPaginated(options: FindNotificationsOptions) {
    const where = buildWhere(options);

    return this.db.notification.findMany({
      where,
      orderBy: { [options.sortBy]: options.sortOrder },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
  }

  count(options: Pick<FindNotificationsOptions, "userId" | "isRead" | "type">) {
    return this.db.notification.count({
      where: buildWhere(options),
    });
  }

  countUnread(userId: string) {
    return this.db.notification.count({
      where: { userId, isRead: false },
    });
  }

  markAsRead(id: string, userId: string, readAt = new Date()) {
    return this.db.notification.updateMany({
      where: { id, userId, isRead: false },
      data: { isRead: true, readAt },
    });
  }

  markAllAsRead(userId: string, readAt = new Date()) {
    return this.db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt },
    });
  }

  /**
   * Hard-deletes read notifications whose readAt is older than the cutoff.
   * Batched via find-then-deleteMany so large backlogs do not lock the table.
   */
  async deleteReadOlderThan(options: {
    olderThan: Date;
    limit: number;
  }): Promise<{ deleted: number }> {
    const stale = await this.db.notification.findMany({
      where: {
        isRead: true,
        readAt: { not: null, lt: options.olderThan },
      },
      select: { id: true },
      take: options.limit,
      orderBy: { readAt: "asc" },
    });

    if (stale.length === 0) {
      return { deleted: 0 };
    }

    const result = await this.db.notification.deleteMany({
      where: { id: { in: stale.map((row) => row.id) } },
    });

    return { deleted: result.count };
  }
}
