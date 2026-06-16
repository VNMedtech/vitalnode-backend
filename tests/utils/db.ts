import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

let testPrisma: PrismaClient | undefined;

export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for integration tests");
    }

    const adapter = new PrismaPg({ connectionString: databaseUrl });
    testPrisma = new PrismaClient({ adapter });
  }

  return testPrisma;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = undefined;
  }
}

export async function resetDatabase(): Promise<void> {
  const prisma = getTestPrisma();

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) {
    return;
  }

  const tableList = tables
    .map(({ tablename }) => `"public"."${tablename}"`)
    .join(", ");

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
  );
}
