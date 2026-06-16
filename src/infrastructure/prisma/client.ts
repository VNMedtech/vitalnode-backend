/**
 * Prisma client singleton — one shared instance for the entire application.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { logger } from "../logger/logger.js";

const adapter = new PrismaPg({ connectionString: env.databaseUrl });

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    adapter,
    log:
      env.nodeEnv === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "event", level: "error" },
            { emit: "event", level: "warn" },
          ]
        : [{ emit: "event", level: "error" }],
  });

  if (env.nodeEnv === "development") {
    client.$on("query", (event) => {
      logger.debug(
        {
          query: event.query,
          durationMs: event.duration,
        },
        "Prisma query",
      );
    });
  }

  client.$on("error", (event) => {
    logger.error({ message: event.message }, "Prisma error");
  });

  client.$on("warn", (event) => {
    logger.warn({ message: event.message }, "Prisma warning");
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.nodeEnv !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
