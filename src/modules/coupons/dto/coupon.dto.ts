import type { Prisma } from "../../../../generated/prisma/client.js";
import type { CouponDto } from "../types/coupon.types.js";

function decimalToString(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

export function toCouponDto(record: {
  id: string;
  code: string;
  discountPercent: Prisma.Decimal;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CouponDto {
  const remainingUses = Math.max(0, record.maxUses - record.usedCount);
  return {
    id: record.id,
    code: record.code,
    discountPercent: decimalToString(record.discountPercent),
    maxUses: record.maxUses,
    usedCount: record.usedCount,
    remainingUses,
    isActive: record.isActive,
    isExhausted: remainingUses <= 0,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
