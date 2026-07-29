import type { Express } from "express";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES } from "../../../src/modules/notifications/constants/notification.constants.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { notificationRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Notifications — HTTP inbox", () => {
  let app: Express;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  async function seedNotification(
    userId: string,
    overrides: {
      type?: string;
      title?: string;
      message?: string;
      isRead?: boolean;
      readAt?: Date | null;
    } = {},
  ) {
    const prisma = getTestPrisma();
    return prisma.notification.create({
      data: {
        userId,
        type: overrides.type ?? NOTIFICATION_TYPES.ORDER_PLACED,
        title: overrides.title ?? "Test notification",
        message: overrides.message ?? "Test message",
        isRead: overrides.isRead ?? false,
        readAt: overrides.readAt ?? null,
      },
    });
  }

  it("rejects unauthenticated access", async () => {
    const listRes = await notificationRequest(app).list();
    const unreadRes = await notificationRequest(app).unreadCount();
    const markAllRes = await notificationRequest(app).markAllAsRead();
    const markRes = await notificationRequest(app).markAsRead(randomUUID());

    expect(listRes.status).toBe(401);
    expect(unreadRes.status).toBe(401);
    expect(markAllRes.status).toBe(401);
    expect(markRes.status).toBe(401);
  });

  it("lists only the authenticated user's notifications", async () => {
    const { auth: buyer } = await registerBuyerViaApi(app);
    const { auth: other } = await registerBuyerViaApi(app);

    const mine = await seedNotification(buyer.user.id, {
      title: "Mine",
      type: NOTIFICATION_TYPES.ORDER_PLACED,
    });
    await seedNotification(other.user.id, {
      title: "Theirs",
      type: NOTIFICATION_TYPES.ORDER_CANCELLED,
    });

    const res = await notificationRequest(app, buyer.accessToken).list();

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Notifications fetched successfully");
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(mine.id);
    expect(res.body.data[0].title).toBe("Mine");
    expect(res.body.data[0].isRead).toBe(false);
    expect(res.body.data[0].readAt).toBeNull();
    expect(res.body.meta.total).toBe(1);
  });

  it("filters by isRead and type", async () => {
    const { auth } = await registerBuyerViaApi(app);

    await seedNotification(auth.user.id, {
      title: "unread-placed",
      type: NOTIFICATION_TYPES.ORDER_PLACED,
      isRead: false,
    });
    await seedNotification(auth.user.id, {
      title: "read-placed",
      type: NOTIFICATION_TYPES.ORDER_PLACED,
      isRead: true,
      readAt: new Date(),
    });
    await seedNotification(auth.user.id, {
      title: "unread-cancelled",
      type: NOTIFICATION_TYPES.ORDER_CANCELLED,
      isRead: false,
    });

    const unreadRes = await notificationRequest(app, auth.accessToken).list({
      isRead: "false",
    });
    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.data).toHaveLength(2);
    expect(
      unreadRes.body.data.every((n: { isRead: boolean }) => n.isRead === false),
    ).toBe(true);

    const typeRes = await notificationRequest(app, auth.accessToken).list({
      type: NOTIFICATION_TYPES.ORDER_CANCELLED,
    });
    expect(typeRes.status).toBe(200);
    expect(typeRes.body.data).toHaveLength(1);
    expect(typeRes.body.data[0].title).toBe("unread-cancelled");
  });

  it("returns unread count for the authenticated user", async () => {
    const { auth: buyer } = await registerBuyerViaApi(app);
    const { auth: other } = await registerBuyerViaApi(app);

    await seedNotification(buyer.user.id, { isRead: false });
    await seedNotification(buyer.user.id, { isRead: false });
    await seedNotification(buyer.user.id, {
      isRead: true,
      readAt: new Date(),
    });
    await seedNotification(other.user.id, { isRead: false });

    const res = await notificationRequest(app, buyer.accessToken).unreadCount();

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Unread count fetched successfully");
    expect(res.body.data).toEqual({ count: 2 });
  });

  it("marks a single notification as read", async () => {
    const { auth } = await registerBuyerViaApi(app);
    const notification = await seedNotification(auth.user.id, {
      isRead: false,
    });

    const res = await notificationRequest(app, auth.accessToken).markAsRead(
      notification.id,
    );

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Notification marked as read");
    expect(res.body.data.id).toBe(notification.id);
    expect(res.body.data.isRead).toBe(true);
    expect(res.body.data.readAt).toBeTruthy();

    const unreadRes = await notificationRequest(
      app,
      auth.accessToken,
    ).unreadCount();
    expect(unreadRes.body.data).toEqual({ count: 0 });

    // Idempotent — already-read stays read with the same readAt
    const second = await notificationRequest(app, auth.accessToken).markAsRead(
      notification.id,
    );
    expect(second.status).toBe(200);
    expect(second.body.data.isRead).toBe(true);
    expect(second.body.data.readAt).toBe(res.body.data.readAt);
  });

  it("returns 404 when marking another user's notification as read", async () => {
    const { auth: owner } = await registerBuyerViaApi(app);
    const { auth: other } = await registerBuyerViaApi(app);
    const notification = await seedNotification(owner.user.id);

    const res = await notificationRequest(app, other.accessToken).markAsRead(
      notification.id,
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown notification id", async () => {
    const { auth } = await registerBuyerViaApi(app);

    const res = await notificationRequest(app, auth.accessToken).markAsRead(
      randomUUID(),
    );

    expect(res.status).toBe(404);
  });

  it("rejects invalid notification id params", async () => {
    const { auth } = await registerBuyerViaApi(app);

    const res = await notificationRequest(app, auth.accessToken).markAsRead(
      "not-a-uuid",
    );

    expect(res.status).toBe(400);
  });

  it("marks all notifications as read", async () => {
    const { auth: buyer } = await registerBuyerViaApi(app);
    const { auth: other } = await registerBuyerViaApi(app);

    await seedNotification(buyer.user.id, { title: "a" });
    await seedNotification(buyer.user.id, { title: "b" });
    const otherUnread = await seedNotification(other.user.id, { title: "c" });

    const res = await notificationRequest(app, buyer.accessToken).markAllAsRead();

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("All notifications marked as read");
    expect(res.body.data).toEqual({ count: 0 });

    const listRes = await notificationRequest(app, buyer.accessToken).list({
      isRead: "false",
    });
    expect(listRes.body.data).toHaveLength(0);

    const prisma = getTestPrisma();
    const otherStillUnread = await prisma.notification.findUniqueOrThrow({
      where: { id: otherUnread.id },
    });
    expect(otherStillUnread.isRead).toBe(false);
    expect(otherStillUnread.readAt).toBeNull();
  });
});
