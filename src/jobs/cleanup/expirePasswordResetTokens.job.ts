/**
 * Periodic sweep: hard-delete expired/used password reset tokens past retention TTL.
 */
import { env } from "../../config/env.js";
import { logger } from "../../infrastructure/logger/logger.js";
import { prisma } from "../../infrastructure/prisma/client.js";

const BATCH_SIZE = 500;
const MAX_ITERATIONS = 10;

let sweepTimer: NodeJS.Timeout | undefined;
let running = false;

export async function runExpirePasswordResetTokensSweep(): Promise<{
  deleted: number;
}> {
  if (running) {
    return { deleted: 0 };
  }

  running = true;
  try {
    const now = new Date();
    const usedCutoff = new Date(
      now.getTime() -
        env.passwordResetTokenRetentionMinutes * 60 * 1000,
    );

    let deleted = 0;

    for (let i = 0; i < MAX_ITERATIONS; i += 1) {
      const candidates = await prisma.passwordResetToken.findMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { usedAt: { not: null, lt: usedCutoff } },
          ],
        },
        select: { id: true },
        take: BATCH_SIZE,
      });

      if (candidates.length === 0) {
        break;
      }

      const result = await prisma.passwordResetToken.deleteMany({
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
          retentionMinutes: env.passwordResetTokenRetentionMinutes,
          intervalMs: env.passwordResetTokenSweepIntervalMs,
        },
        "PasswordResetToken cleanup sweep completed",
      );
    }

    return { deleted };
  } catch (error) {
    logger.error({ err: error }, "PasswordResetToken cleanup sweep failed");
    return { deleted: 0 };
  } finally {
    running = false;
  }
}

export function startExpirePasswordResetTokensJob(): void {
  if (env.nodeEnv === "test") {
    return;
  }

  if (sweepTimer) {
    return;
  }

  const intervalMs = env.passwordResetTokenSweepIntervalMs;

  // First pass shortly after boot so stale rows are cleared without waiting a full interval.
  const bootDelay = setTimeout(() => {
    void runExpirePasswordResetTokensSweep();
  }, 5_000);
  bootDelay.unref();

  sweepTimer = setInterval(() => {
    void runExpirePasswordResetTokensSweep();
  }, intervalMs);
  sweepTimer.unref();

  logger.info(
    {
      retentionMinutes: env.passwordResetTokenRetentionMinutes,
      intervalMs,
    },
    "PasswordResetToken cleanup sweep job started",
  );
}

export function stopExpirePasswordResetTokensJob(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = undefined;
  }
}
