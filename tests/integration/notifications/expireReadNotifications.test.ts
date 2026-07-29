import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NotificationRepository } from "../../../src/modules/notifications/repositories/notification.repository.js";
import { NotificationService } from "../../../src/modules/notifications/services/notification.service.js";
import { UserRole } from "../../../src/shared/enums/userRole.enum.js";
import { createUserWithPassword } from "../../factories/user.factory.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("expireReadNotifications cleanup", () => {
  let userId: string;

  beforeAll(async () => {
    await resetDatabase();
    const prisma = getTestPrisma();
    const user = await createUserWithPassword(prisma, {
      email: `notif-cleanup-${Date.now()}@example.com`,
      role: UserRole.BUYER,
    });
    userId = user.id;
  });

  beforeEach(async () => {
    const prisma = getTestPrisma();
    await prisma.notification.deleteMany({ where: { userId } });
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  async function createNotification(overrides: {
    isRead?: boolean;
    readAt?: Date | null;
    title?: string;
  } = {}) {
    const prisma = getTestPrisma();
    return prisma.notification.create({
      data: {
        userId,
        type: "TEST",
        title: overrides.title ?? "Test notification",
        message: "Cleanup test message",
        isRead: overrides.isRead ?? false,
        readAt: overrides.readAt ?? null,
      },
    });
  }

  it("deletes read notifications older than the TTL", async () => {
    const service = new NotificationService();
    const old = await createNotification({
      isRead: true,
      readAt: new Date(Date.now() - 31 * DAY_MS),
      title: "old-read",
    });

    const result = await service.deleteReadOlderThan({
      ttlDays: 30,
      batchSize: 100,
    });

    expect(result.deleted).toBe(1);
    const prisma = getTestPrisma();
    expect(await prisma.notification.findUnique({ where: { id: old.id } })).toBeNull();
  });

  it("keeps read notifications within the TTL", async () => {
    const service = new NotificationService();
    const fresh = await createNotification({
      isRead: true,
      readAt: new Date(Date.now() - 5 * DAY_MS),
      title: "fresh-read",
    });

    const result = await service.deleteReadOlderThan({
      ttlDays: 30,
      batchSize: 100,
    });

    expect(result.deleted).toBe(0);
    const prisma = getTestPrisma();
    expect(
      await prisma.notification.findUnique({ where: { id: fresh.id } }),
    ).not.toBeNull();
  });

  it("keeps unread notifications even when older than the TTL", async () => {
    const service = new NotificationService();
    const unread = await createNotification({
      isRead: false,
      readAt: null,
      title: "old-unread",
    });

    // Force an old created/updated timestamp without marking read.
    const prisma = getTestPrisma();
    await prisma.notification.update({
      where: { id: unread.id },
      data: {
        createdAt: new Date(Date.now() - 60 * DAY_MS),
        updatedAt: new Date(Date.now() - 60 * DAY_MS),
      },
    });

    const result = await service.deleteReadOlderThan({
      ttlDays: 30,
      batchSize: 100,
    });

    expect(result.deleted).toBe(0);
    expect(
      await prisma.notification.findUnique({ where: { id: unread.id } }),
    ).not.toBeNull();
  });

  it("sets readAt on first mark-as-read and does not overwrite it", async () => {
    const prisma = getTestPrisma();
    const repo = new NotificationRepository(prisma);
    const service = new NotificationService();

    const notification = await createNotification({ isRead: false });
    expect(notification.readAt).toBeNull();

    const firstReadAt = new Date("2025-01-15T12:00:00.000Z");
    await repo.markAsRead(notification.id, userId, firstReadAt);

    const afterFirst = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(afterFirst.isRead).toBe(true);
    expect(afterFirst.readAt?.toISOString()).toBe(firstReadAt.toISOString());

    // Service path skips update when already read — readAt stays put.
    const dto = await service.markAsRead(userId, notification.id);
    expect(dto.readAt).toBe(firstReadAt.toISOString());

    const afterSecond = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(afterSecond.readAt?.toISOString()).toBe(firstReadAt.toISOString());
  });

  it("sets readAt when mark-all-as-read runs", async () => {
    const prisma = getTestPrisma();
    const repo = new NotificationRepository(prisma);

    const a = await createNotification({ title: "a" });
    const b = await createNotification({ title: "b" });

    const readAt = new Date("2025-02-01T08:00:00.000Z");
    await repo.markAllAsRead(userId, readAt);

    const updated = await prisma.notification.findMany({
      where: { id: { in: [a.id, b.id] } },
      orderBy: { title: "asc" },
    });

    expect(updated).toHaveLength(2);
    for (const row of updated) {
      expect(row.isRead).toBe(true);
      expect(row.readAt?.toISOString()).toBe(readAt.toISOString());
    }
  });

  it("respects batch limit across iterations", async () => {
    const service = new NotificationService();
    const olderThan = new Date(Date.now() - 40 * DAY_MS);

    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createNotification({
          isRead: true,
          readAt: olderThan,
          title: `batch-${i}`,
        }),
      ),
    );

    const result = await service.deleteReadOlderThan({
      olderThan: new Date(Date.now() - 30 * DAY_MS),
      batchSize: 2,
      maxIterations: 2,
    });

    // 2 iterations × batch of 2 = 4 deleted; one remains for next sweep
    expect(result.deleted).toBe(4);

    const prisma = getTestPrisma();
    const remaining = await prisma.notification.count({
      where: { userId, isRead: true },
    });
    expect(remaining).toBe(1);
  });
});
