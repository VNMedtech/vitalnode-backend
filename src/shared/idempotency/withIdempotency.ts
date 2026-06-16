import { IdempotencyKeyStatus } from "../../../generated/prisma/client.js";
import { ConflictError } from "../errors/app.errors.js";
import { IdempotencyRepository } from "./idempotency.repository.js";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export interface WithIdempotencyInput<T> {
  actorUserId: string;
  key: string;
  route: string;
  requestHash?: string;
  ttlMs?: number;
  handler: () => Promise<T>;
}

export async function withIdempotency<T>(
  input: WithIdempotencyInput<T>,
): Promise<T> {
  const repo = new IdempotencyRepository(
    (await import("../../infrastructure/prisma/client.js")).prisma,
  );
  const existing = await repo.findByActorKeyRoute(
    input.actorUserId,
    input.key,
    input.route,
  );

  if (existing) {
    if (existing.status === IdempotencyKeyStatus.COMPLETED) {
      return existing.responseBody as T;
    }

    if (existing.status === IdempotencyKeyStatus.PROCESSING) {
      throw new ConflictError("Request with this idempotency key is in progress");
    }
  }

  const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS));

  let record;
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
    if (prismaError.code === "P2002") {
      const concurrent = await repo.findByActorKeyRoute(
        input.actorUserId,
        input.key,
        input.route,
      );
      if (concurrent?.status === IdempotencyKeyStatus.COMPLETED) {
        return concurrent.responseBody as T;
      }
      throw new ConflictError("Request with this idempotency key is in progress");
    }
    throw error;
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
