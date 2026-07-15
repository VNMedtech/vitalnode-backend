/**
 * TEMPORARY — backfill NMC registration numbers for legacy doctor buyers.
 *
 * Finds BuyerProfile rows where buyerType = DOCTOR and nmcRegistrationNumber is null,
 * then assigns a unique alphanumeric placeholder: TEMP + first 12 hex chars of userId.
 *
 * Idempotent: safe to re-run; skips rows that already have a value.
 * Does not run automatically on migrate/seed/bootstrap.
 *
 * Run: npm run db:backfill-nmc
 *
 * Remove this script once all environments have real NMCs (or TEMP placeholders
 * have been replaced via buyer profile update).
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { BuyerType, PrismaClient } from "../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Cannot run NMC backfill.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function tempNmcFromUserId(userId: string): string {
  const hex = userId.replace(/-/g, "").slice(0, 12);
  return `TEMP${hex}`;
}

async function main() {
  const legacyDoctors = await prisma.buyerProfile.findMany({
    where: {
      buyerType: BuyerType.DOCTOR,
      nmcRegistrationNumber: null,
    },
    select: {
      id: true,
      userId: true,
      user: { select: { email: true } },
    },
  });

  if (legacyDoctors.length === 0) {
    console.log("No doctor buyers with null NMC — nothing to backfill.");
    return;
  }

  let updated = 0;

  for (const profile of legacyDoctors) {
    const nmc = tempNmcFromUserId(profile.userId);

    await prisma.buyerProfile.update({
      where: { id: profile.id },
      data: { nmcRegistrationNumber: nmc },
    });

    console.log(
      `Backfilled ${profile.user.email}: null → ${nmc}`,
    );
    updated += 1;
  }

  console.log(`Done. Updated ${updated} doctor buyer profile(s).`);
}

main()
  .catch((error) => {
    console.error("NMC backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
