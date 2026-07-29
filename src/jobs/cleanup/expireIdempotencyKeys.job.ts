/**
 * Periodic sweep: hard-delete IdempotencyKey rows past expiresAt.
 */
import { env } from "../../config/env.js";
import { prisma } from "../../infrastructure/prisma/client.js";
import { logger } from "../../infrastructure/logger/logger.js";
import { IdempotencyRepository } from "../../shared/idempotency/idempotency.repository.js";

const BATCH_SIZE = 500;
const MAX_ITERATIONS = 10;

let sweepTimer: NodeJS.Timeout | undefined;
let running = false;

export async function runExpireIdempotencyKeysSweep(): Promise<{
  deleted: number;
}> {
  if (running) {
    return { deleted: 0 };
  }

  running = true;
  try {
    const repo = new IdempotencyRepository(prisma);
    const before = new Date();
    let deleted = 0;

    for (let i = 0; i < MAX_ITERATIONS; i += 1) {
      const result = await repo.deleteExpired({
        before,
        limit: BATCH_SIZE,
      });
      deleted += result.deleted;

      if (result.deleted < BATCH_SIZE) {
        break;
      }
    }

    if (deleted > 0) {
      logger.info(
        {
          deleted,
          intervalMs: env.idempotencySweepIntervalMs,
        },
        "IdempotencyKey TTL sweep completed",
      );
    }

    return { deleted };
  } catch (error) {
    logger.error({ err: error }, "IdempotencyKey TTL sweep failed");
    return { deleted: 0 };
  } finally {
    running = false;
  }
}

export function startExpireIdempotencyKeysJob(): void {
  if (env.nodeEnv === "test") {
    return;
  }

  if (sweepTimer) {
    return;
  }

  const intervalMs = env.idempotencySweepIntervalMs;

  // First pass shortly after boot so stale rows are cleared without waiting a full interval.
  const bootDelay = setTimeout(() => {
    void runExpireIdempotencyKeysSweep();
  }, 5_000);
  bootDelay.unref();

  sweepTimer = setInterval(() => {
    void runExpireIdempotencyKeysSweep();
  }, intervalMs);
  sweepTimer.unref();

  logger.info(
    {
      ttlMs: env.idempotencyTtlMs,
      intervalMs,
    },
    "IdempotencyKey TTL sweep job started",
  );
}

export function stopExpireIdempotencyKeysJob(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = undefined;
  }
}
