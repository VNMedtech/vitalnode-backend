import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import {
  COUPON_GENERATED_CODE_LENGTH,
} from "../constants/coupon.constants.js";
import type { CouponSortField } from "../constants/coupon.constants.js";

const couponSelect = {
  id: true,
  code: true,
  discountPercent: true,
  maxUses: true,
  usedCount: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CouponSelect;

export type CouponRecord = Prisma.CouponGetPayload<{
  select: typeof couponSelect;
}>;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCouponCode(
  length = COUPON_GENERATED_CODE_LENGTH,
): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return code;
}

export class CouponRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  findById(id: string) {
    return this.prisma.coupon.findUnique({
      where: { id },
      select: couponSelect,
    });
  }

  findByCode(code: string) {
    return this.prisma.coupon.findUnique({
      where: { code },
      select: couponSelect,
    });
  }

  async lockById(id: string): Promise<CouponRecord | null> {
    await this.prisma.$queryRawUnsafe(
      `SELECT id FROM "Coupon" WHERE id = $1 FOR UPDATE`,
      id,
    );
    return this.findById(id);
  }

  async lockByCode(code: string): Promise<CouponRecord | null> {
    await this.prisma.$queryRawUnsafe(
      `SELECT id FROM "Coupon" WHERE code = $1 FOR UPDATE`,
      code,
    );
    return this.findByCode(code);
  }

  create(data: {
    code: string;
    discountPercent: Prisma.Decimal | number;
    maxUses: number;
    isActive: boolean;
  }) {
    return this.prisma.coupon.create({
      data: {
        code: data.code,
        discountPercent: data.discountPercent,
        maxUses: data.maxUses,
        isActive: data.isActive,
      },
      select: couponSelect,
    });
  }

  update(
    id: string,
    data: {
      discountPercent?: Prisma.Decimal | number;
      maxUses?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.coupon.update({
      where: { id },
      data,
      select: couponSelect,
    });
  }

  async list(options: {
    page: number;
    limit: number;
    sortBy: CouponSortField;
    sortOrder: "asc" | "desc";
    search?: string;
    isActive?: boolean;
  }) {
    const where: Prisma.CouponWhereInput = {
      ...(options.search
        ? { code: { contains: options.search, mode: "insensitive" } }
        : {}),
      ...(options.isActive !== undefined ? { isActive: options.isActive } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        select: couponSelect,
        orderBy: { [options.sortBy]: options.sortOrder },
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return { items, total };
  }

  findRedemptionByCouponAndBuyer(couponId: string, buyerId: string) {
    return this.prisma.couponRedemption.findUnique({
      where: {
        couponId_buyerId: { couponId, buyerId },
      },
      select: { id: true, orderId: true },
    });
  }

  findRedemptionByOrderId(orderId: string) {
    return this.prisma.couponRedemption.findUnique({
      where: { orderId },
      select: {
        id: true,
        couponId: true,
        buyerId: true,
        orderId: true,
      },
    });
  }

  createRedemption(data: {
    couponId: string;
    buyerId: string;
    orderId: string;
  }) {
    return this.prisma.couponRedemption.create({
      data,
      select: { id: true },
    });
  }

  deleteRedemption(id: string) {
    return this.prisma.couponRedemption.delete({
      where: { id },
      select: { id: true, couponId: true },
    });
  }

  incrementUsedCount(id: string) {
    return this.prisma.coupon.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
      select: couponSelect,
    });
  }

  decrementUsedCount(id: string) {
    return this.prisma.coupon.update({
      where: { id },
      data: { usedCount: { decrement: 1 } },
      select: couponSelect,
    });
  }
}
