/**
 * Periodic sweep: hard-delete expired/revoked auth sessions past retention TTL.
 */
import { env } from "../../config/env.js";
import { logger } from "../../infrastructure/logger/logger.js";
import { prisma } from "../../infrastructure/prisma/client.js";

const BATCH_SIZE = 500;
const MAX_ITERATIONS = 10;

let sweepTimer: NodeJS.Timeout | undefined;
let running = false;

export async function runExpireAuthSessionsSweep(): Promise<{ deleted: number }> {
  if (running) {
    return { deleted: 0 };
  }

  running = true;
  try {
    const now = new Date();
    const revokedCutoff = new Date(
      now.getTime() - env.authSessionTtlDays * 24 * 60 * 60 * 1000,
    );

    let deleted = 0;

    for (let i = 0; i < MAX_ITERATIONS; i += 1) {
      const candidates = await prisma.authSession.findMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { revokedAt: { not: null, lt: revokedCutoff } },
          ],
        },
        select: { id: true },
        take: BATCH_SIZE,
      });

      if (candidates.length === 0) {
        break;
      }

      const result = await prisma.authSession.deleteMany({
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
          ttlDays: env.authSessionTtlDays,
          intervalMs: env.authSessionSweepIntervalMs,
        },
        "AuthSession cleanup sweep completed",
      );
    }

    return { deleted };
  } catch (error) {
    logger.error({ err: error }, "AuthSession cleanup sweep failed");
    return { deleted: 0 };
  } finally {
    running = false;
  }
}

export function startExpireAuthSessionsJob(): void {
  if (env.nodeEnv === "test") {
    return;
  }

  if (sweepTimer) {
    return;
  }

  const intervalMs = env.authSessionSweepIntervalMs;

  // First pass shortly after boot so stale rows are cleared without waiting a full interval.
  const bootDelay = setTimeout(() => {
    void runExpireAuthSessionsSweep();
  }, 5_000);
  bootDelay.unref();

  sweepTimer = setInterval(() => {
    void runExpireAuthSessionsSweep();
  }, intervalMs);
  sweepTimer.unref();

  logger.info(
    {
      ttlDays: env.authSessionTtlDays,
      intervalMs,
    },
    "AuthSession cleanup sweep job started",
  );
}

export function stopExpireAuthSessionsJob(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = undefined;
  }
}
