/**
 * Periodic sweep: cancel PENDING_PAYMENT orders past unpaid-checkout TTL.
 * Matches docs/COMMERCE_TRANSACTION_STRATEGY.md §16 / expirePendingOrders.job.
 */
import { env } from "../../config/env.js";
import { logger } from "../../infrastructure/logger/logger.js";
import { OrderCancellationService } from "../../modules/orders/services/orderCancellation.service.js";

const cancellationService = new OrderCancellationService();

let sweepTimer: NodeJS.Timeout | undefined;
let running = false;

export async function runExpirePendingOrdersSweep(): Promise<void> {
  if (running) {
    return;
  }

  const actorUserId = env.systemActorUserId;
  if (!actorUserId) {
    logger.warn(
      "Skipping PENDING_PAYMENT TTL sweep — SYSTEM_ACTOR_USER_ID is not set",
    );
    return;
  }

  running = true;
  try {
    const result = await cancellationService.expireStalePendingPaymentOrders({
      actorUserId,
      olderThanMs: env.pendingPaymentTtlMinutes * 60 * 1000,
      limit: 50,
    });

    if (result.scanned > 0) {
      logger.info(
        {
          scanned: result.scanned,
          cancelled: result.cancelled,
          failed: result.failed,
          ttlMinutes: env.pendingPaymentTtlMinutes,
        },
        "PENDING_PAYMENT TTL sweep completed",
      );
    }
  } catch (error) {
    logger.error(
      { err: error },
      "PENDING_PAYMENT TTL sweep failed",
    );
  } finally {
    running = false;
  }
}

export function startExpirePendingOrdersJob(): void {
  if (env.nodeEnv === "test") {
    return;
  }

  if (sweepTimer) {
    return;
  }

  const intervalMs = env.pendingPaymentSweepIntervalMs;

  // First pass shortly after boot so stale orders are cleared without waiting a full interval.
  const bootDelay = setTimeout(() => {
    void runExpirePendingOrdersSweep();
  }, 5_000);
  bootDelay.unref();

  sweepTimer = setInterval(() => {
    void runExpirePendingOrdersSweep();
  }, intervalMs);
  sweepTimer.unref();

  logger.info(
    {
      ttlMinutes: env.pendingPaymentTtlMinutes,
      intervalMs,
    },
    "PENDING_PAYMENT TTL sweep job started",
  );
}

export function stopExpirePendingOrdersJob(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = undefined;
  }
}
