import { Prisma } from "../../../../generated/prisma/client.js";

export function decimalToPaise(amount: Prisma.Decimal): number {
  // Always whole paise — fractional values (e.g. coupon %) must not reach Razorpay.
  return amount.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

export function paiseToDecimal(amountPaise: number): Prisma.Decimal {
  return new Prisma.Decimal(amountPaise).div(100);
}

export function amountsMatch(
  expected: Prisma.Decimal,
  actualPaise: number,
): boolean {
  return decimalToPaise(expected) === actualPaise;
}
