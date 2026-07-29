import { IdempotencyKeyStatus } from "../../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { ConflictError } from "../errors/app.errors.js";
import {
  IdempotencyRepository,
  type IdempotencyKeyRecord,
} from "./idempotency.repository.js";

/** Fallback when env is unavailable; equals the default IDEMPOTENCY_TTL_MS (24h). */
export const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export interface WithIdempotencyInput<T> {
  actorUserId: string;
  key: string;
  route: string;
  requestHash?: string;
  ttlMs?: number;
  handler: () => Promise<T>;
}

function isExpired(record: IdempotencyKeyRecord, nowMs = Date.now()): boolean {
  return record.expiresAt.getTime() <= nowMs;
}

async function deleteExpiredQuietly(
  repo: IdempotencyRepository,
  id: string,
): Promise<void> {
  try {
    await repo.deleteById(id);
  } catch (error) {
    const prismaError = error as { code?: string };
    // Another request may have already deleted the expired row.
    if (prismaError.code !== "P2025") {
      throw error;
    }
  }
}

async function tryReturnCachedCompleted<T>(
  repo: IdempotencyRepository,
  input: WithIdempotencyInput<T>,
  known?: IdempotencyKeyRecord | null,
): Promise<T | undefined> {
  const concurrent =
    known ??
    (await repo.findByActorKeyRoute(
      input.actorUserId,
      input.key,
      input.route,
    ));

  if (
    concurrent?.status === IdempotencyKeyStatus.COMPLETED &&
    !isExpired(concurrent)
  ) {
    return concurrent.responseBody as T;
  }

  return undefined;
}

export async function withIdempotency<T>(
  input: WithIdempotencyInput<T>,
): Promise<T> {
  const repo = new IdempotencyRepository(
    (await import("../../infrastructure/prisma/client.js")).prisma,
  );
  const ttlMs = input.ttlMs ?? env.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs);

  const existing = await repo.findByActorKeyRoute(
    input.actorUserId,
    input.key,
    input.route,
  );

  if (existing) {
    if (isExpired(existing)) {
      await deleteExpiredQuietly(repo, existing.id);
    } else if (existing.status === IdempotencyKeyStatus.COMPLETED) {
      return existing.responseBody as T;
    } else if (existing.status === IdempotencyKeyStatus.PROCESSING) {
      throw new ConflictError("Request with this idempotency key is in progress");
    }
    // Non-expired FAILED: fall through; create hits unique constraint → conflict (unchanged).
  }

  let record: { id: string };
  try {
    record = await repo.createProcessing({
      actorUserId: input.actorUserId,
      key: input.key,
      route: input.route,
      requestHash: input.requestHash,
      expiresAt,
    });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code !== "P2002") {
      throw error;
    }

    const concurrent = await repo.findByActorKeyRoute(
      input.actorUserId,
      input.key,
      input.route,
    );

    if (concurrent && isExpired(concurrent)) {
      await deleteExpiredQuietly(repo, concurrent.id);
      try {
        record = await repo.createProcessing({
          actorUserId: input.actorUserId,
          key: input.key,
          route: input.route,
          requestHash: input.requestHash,
          expiresAt,
        });
      } catch (retryError) {
        const retryPrismaError = retryError as { code?: string };
        if (retryPrismaError.code !== "P2002") {
          throw retryError;
        }
        const cached = await tryReturnCachedCompleted(repo, input);
        if (cached !== undefined) {
          return cached;
        }
        throw new ConflictError(
          "Request with this idempotency key is in progress",
        );
      }
    } else {
      const cached = await tryReturnCachedCompleted(repo, input, concurrent);
      if (cached !== undefined) {
        return cached;
      }
      throw new ConflictError("Request with this idempotency key is in progress");
    }
  }

  try {
    const result = await input.handler();
    await repo.markCompleted(record.id, result);
    return result;
  } catch (error) {
    await repo.markFailed(record.id);
    throw error;
  }
}
