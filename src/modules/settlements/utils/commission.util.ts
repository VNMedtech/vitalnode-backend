import { Prisma } from "../../../../generated/prisma/client.js";

export interface CommissionBreakdown {
  grossAmount: Prisma.Decimal;
  commissionPercentage: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
  sellerReceivableAmount: Prisma.Decimal;
}

export function calculateCommissionBreakdown(
  grossAmount: Prisma.Decimal,
  commissionPercentage: Prisma.Decimal,
): CommissionBreakdown {
  const commissionAmount = grossAmount
    .mul(commissionPercentage)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const sellerReceivableAmount = grossAmount
    .sub(commissionAmount)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  return {
    grossAmount,
    commissionPercentage,
    commissionAmount,
    sellerReceivableAmount,
  };
}

export function sumDecimal(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce(
    (total, value) => total.add(value),
    new Prisma.Decimal(0),
  );
}
