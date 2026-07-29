import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { IdempotencyKeyStatus } from "../../../generated/prisma/client.js";
import { runExpireIdempotencyKeysSweep } from "../../../src/jobs/cleanup/expireIdempotencyKeys.job.js";
import { IdempotencyRepository } from "../../../src/shared/idempotency/idempotency.repository.js";
import { withIdempotency } from "../../../src/shared/idempotency/withIdempotency.js";
import { ConflictError } from "../../../src/shared/errors/app.errors.js";
import { UserRole } from "../../../src/shared/enums/userRole.enum.js";
import { createUserWithPassword } from "../../factories/user.factory.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe("IdempotencyKey expiry and cleanup", () => {
  let actorUserId: string;

  beforeAll(async () => {
    await resetDatabase();
    const prisma = getTestPrisma();
    const user = await createUserWithPassword(prisma, {
      email: `idem-cleanup-${Date.now()}@example.com`,
      role: UserRole.BUYER,
    });
    actorUserId = user.id;
  });

  beforeEach(async () => {
    const prisma = getTestPrisma();
    await prisma.idempotencyKey.deleteMany({ where: { actorUserId } });
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  it("returns cached COMPLETED response within TTL", async () => {
    let handlerCalls = 0;

    const first = await withIdempotency({
      actorUserId,
      key: "cache-within-ttl",
      route: "TEST:/idempotency/cache",
      handler: async () => {
        handlerCalls += 1;
        return { value: "first" };
      },
    });

    const second = await withIdempotency({
      actorUserId,
      key: "cache-within-ttl",
      route: "TEST:/idempotency/cache",
      handler: async () => {
        handlerCalls += 1;
        return { value: "second" };
      },
    });

    expect(first).toEqual({ value: "first" });
    expect(second).toEqual({ value: "first" });
    expect(handlerCalls).toBe(1);

    const prisma = getTestPrisma();
    const rows = await prisma.idempotencyKey.findMany({
      where: {
        actorUserId,
        key: "cache-within-ttl",
        route: "TEST:/idempotency/cache",
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe(IdempotencyKeyStatus.COMPLETED);
  });

  it("runs handler again after expiresAt and replaces the expired row", async () => {
    let handlerCalls = 0;

    await withIdempotency({
      actorUserId,
      key: "reuse-after-expiry",
      route: "TEST:/idempotency/reuse",
      handler: async () => {
        handlerCalls += 1;
        return { value: "stale" };
      },
    });

    const prisma = getTestPrisma();
    await prisma.idempotencyKey.updateMany({
      where: {
        actorUserId,
        key: "reuse-after-expiry",
        route: "TEST:/idempotency/reuse",
      },
      data: { expiresAt: new Date(Date.now() - HOUR_MS) },
    });

    const second = await withIdempotency({
      actorUserId,
      key: "reuse-after-expiry",
      route: "TEST:/idempotency/reuse",
      handler: async () => {
        handlerCalls += 1;
        return { value: "fresh" };
      },
    });

    expect(second).toEqual({ value: "fresh" });
    expect(handlerCalls).toBe(2);

    const rows = await prisma.idempotencyKey.findMany({
      where: {
        actorUserId,
        key: "reuse-after-expiry",
        route: "TEST:/idempotency/reuse",
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.responseBody).toEqual({ value: "fresh" });
    expect(rows[0]?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("conflicts when a non-expired PROCESSING key is reused", async () => {
    const prisma = getTestPrisma();
    await prisma.idempotencyKey.create({
      data: {
        actorUserId,
        key: "processing-conflict",
        route: "TEST:/idempotency/processing",
        status: IdempotencyKeyStatus.PROCESSING,
        expiresAt: new Date(Date.now() + DAY_MS),
      },
    });

    await expect(
      withIdempotency({
        actorUserId,
        key: "processing-conflict",
        route: "TEST:/idempotency/processing",
        handler: async () => ({ value: "should-not-run" }),
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("sweeper deletes only expired rows and keeps non-expired", async () => {
    const prisma = getTestPrisma();
    const repo = new IdempotencyRepository(prisma);

    const expired = await repo.createProcessing({
      actorUserId,
      key: "sweep-expired",
      route: "TEST:/idempotency/sweep",
      expiresAt: new Date(Date.now() - HOUR_MS),
    });
    const fresh = await repo.createProcessing({
      actorUserId,
      key: "sweep-fresh",
      route: "TEST:/idempotency/sweep",
      expiresAt: new Date(Date.now() + DAY_MS),
    });

    const result = await runExpireIdempotencyKeysSweep();

    expect(result.deleted).toBe(1);
    expect(
      await prisma.idempotencyKey.findUnique({ where: { id: expired.id } }),
    ).toBeNull();
    expect(
      await prisma.idempotencyKey.findUnique({ where: { id: fresh.id } }),
    ).not.toBeNull();
  });

  it("deleteExpired respects batch limit", async () => {
    const prisma = getTestPrisma();
    const repo = new IdempotencyRepository(prisma);
    const expiredAt = new Date(Date.now() - HOUR_MS);

    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        repo.createProcessing({
          actorUserId,
          key: `batch-${i}`,
          route: "TEST:/idempotency/batch",
          expiresAt: expiredAt,
        }),
      ),
    );

    const firstPass = await repo.deleteExpired({
      before: new Date(),
      limit: 2,
    });
    expect(firstPass.deleted).toBe(2);

    const remaining = await prisma.idempotencyKey.count({
      where: {
        actorUserId,
        route: "TEST:/idempotency/batch",
      },
    });
    expect(remaining).toBe(3);
  });
});
