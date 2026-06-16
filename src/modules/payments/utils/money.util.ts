import { Prisma } from "../../../../generated/prisma/client.js";

export function decimalToPaise(amount: Prisma.Decimal): number {
  return amount.mul(100).toNumber();
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
