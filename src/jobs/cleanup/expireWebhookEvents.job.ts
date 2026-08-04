/**
 * Periodic sweep: hard-delete processed webhook events past retention TTL.
 */
import { env } from "../../config/env.js";
import { logger } from "../../infrastructure/logger/logger.js";
import { prisma } from "../../infrastructure/prisma/client.js";

const BATCH_SIZE = 500;
const MAX_ITERATIONS = 10;

let sweepTimer: NodeJS.Timeout | undefined;
let running = false;

export async function runExpireWebhookEventsSweep(): Promise<{ deleted: number }> {
  if (running) {
    return { deleted: 0 };
  }

  running = true;
  try {
    const cutoff = new Date(
      Date.now() - env.webhookEventTtlDays * 24 * 60 * 60 * 1000,
    );
    let deleted = 0;

    for (let i = 0; i < MAX_ITERATIONS; i += 1) {
      const candidates = await prisma.webhookEvent.findMany({
        where: {
          processedAt: { not: null },
          createdAt: { lt: cutoff },
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
        take: BATCH_SIZE,
      });

      if (candidates.length === 0) {
        break;
      }

      const result = await prisma.webhookEvent.deleteMany({
        where: { id: { in: candidates.map((row) => row.id) } },
      });
      deleted += result.count;

      if (candidates.length < BATCH_SIZE) {
        break;
      }
    }

    if (deleted > 0) {
      logger.info(
        {
          deleted,
          ttlDays: env.webhookEventTtlDays,
          intervalMs: env.webhookEventSweepIntervalMs,
        },
        "WebhookEvent cleanup sweep completed",
      );
    }

    return { deleted };
  } catch (error) {
    logger.error({ err: error }, "WebhookEvent cleanup sweep failed");
    return { deleted: 0 };
  } finally {
    running = false;
  }
}

export function startExpireWebhookEventsJob(): void {
  if (env.nodeEnv === "test") {
    return;
  }

  if (sweepTimer) {
    return;
  }

  const intervalMs = env.webhookEventSweepIntervalMs;

  // First pass shortly after boot so stale rows are cleared without waiting a full interval.
  const bootDelay = setTimeout(() => {
    void runExpireWebhookEventsSweep();
  }, 5_000);
  bootDelay.unref();

  sweepTimer = setInterval(() => {
    void runExpireWebhookEventsSweep();
  }, intervalMs);
  sweepTimer.unref();

  logger.info(
    {
      ttlDays: env.webhookEventTtlDays,
      intervalMs,
    },
    "WebhookEvent cleanup sweep job started",
  );
}

export function stopExpireWebhookEventsJob(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = undefined;
  }
}
