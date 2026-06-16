import { logger } from "../../../infrastructure/logger/logger.js";
import { NOTIFICATION_RETRY } from "../constants/notification.constants.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  operation: string;
  context?: Record<string, unknown>;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? NOTIFICATION_RETRY.MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? NOTIFICATION_RETRY.BASE_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        logger.error(
          {
            err: error,
            operation: options.operation,
            attempt,
            maxAttempts,
            ...options.context,
          },
          "Notification operation failed after retries",
        );
        throw error;
      }

      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      logger.warn(
        {
          err: error,
          operation: options.operation,
          attempt,
          maxAttempts,
          delayMs,
          ...options.context,
        },
        "Notification operation failed — retrying",
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}
