import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/prisma/client.js";
import type { TransactionOptions, TxClient } from "./transaction.types.js";

const DEFAULT_OPTIONS: TransactionOptions = {
  maxWait: 5_000,
  timeout: 15_000,
  isolationLevel: "ReadCommitted",
};

function isRetryableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034";
  }

  const msg = error instanceof Error ? error.message : "";
  return msg.includes("deadlock") || msg.includes("40001");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runInTransaction<T>(
  fn: (tx: TxClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        maxWait: opts.maxWait,
        timeout: opts.timeout,
        isolationLevel:
          opts.isolationLevel as Prisma.TransactionIsolationLevel,
      });
    } catch (error) {
      if (!isRetryableError(error) || attempt === maxAttempts) {
        throw error;
      }

      const delay = 50 * 2 ** (attempt - 1) + Math.random() * 25;
      await sleep(delay);
    }
  }

  throw new Error("runInTransaction: unreachable");
}
