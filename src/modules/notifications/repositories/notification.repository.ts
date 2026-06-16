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

  markAsRead(id: string, userId: string) {
    return this.db.notification.updateMany({
      where: { id, userId, isRead: false },
      data: { isRead: true },
    });
  }

  markAllAsRead(userId: string) {
    return this.db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
