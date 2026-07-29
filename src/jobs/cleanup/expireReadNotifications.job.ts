/**
 * Periodic sweep: hard-delete read in-app notifications past retention TTL.
 */
import { env } from "../../config/env.js";
import { logger } from "../../infrastructure/logger/logger.js";
import { NotificationService } from "../../modules/notifications/services/notification.service.js";

const notificationService = new NotificationService();

let sweepTimer: NodeJS.Timeout | undefined;
let running = false;

export async function runExpireReadNotificationsSweep(): Promise<void> {
  if (running) {
    return;
  }

  running = true;
  try {
    const result = await notificationService.deleteReadOlderThan({
      ttlDays: env.readNotificationTtlDays,
      batchSize: 500,
      maxIterations: 10,
    });

    if (result.deleted > 0) {
      logger.info(
        {
          deleted: result.deleted,
          ttlDays: env.readNotificationTtlDays,
        },
        "Read notification TTL sweep completed",
      );
    }
  } catch (error) {
    logger.error({ err: error }, "Read notification TTL sweep failed");
  } finally {
    running = false;
  }
}

export function startExpireReadNotificationsJob(): void {
  if (env.nodeEnv === "test") {
    return;
  }

  if (sweepTimer) {
    return;
  }

  const intervalMs = env.readNotificationSweepIntervalMs;

  // First pass shortly after boot so stale rows are cleared without waiting a full interval.
  const bootDelay = setTimeout(() => {
    void runExpireReadNotificationsSweep();
  }, 5_000);
  bootDelay.unref();

  sweepTimer = setInterval(() => {
    void runExpireReadNotificationsSweep();
  }, intervalMs);
  sweepTimer.unref();

  logger.info(
    {
      ttlDays: env.readNotificationTtlDays,
      intervalMs,
    },
    "Read notification TTL sweep job started",
  );
}

export function stopExpireReadNotificationsJob(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = undefined;
  }
}
