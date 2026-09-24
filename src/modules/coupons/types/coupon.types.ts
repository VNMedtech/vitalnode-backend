import type { Prisma } from "../../../../generated/prisma/client.js";
import type { CouponSortField } from "../constants/coupon.constants.js";

export interface CouponDto {
  id: string;
  code: string;
  discountPercent: string;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  isActive: boolean;
  isExhausted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CouponValidateResultDto {
  valid: boolean;
  code: string;
  discountPercent: string;
  discountAmount: string;
  subtotal: string;
  totalAfterDiscount: string;
  message: string;
}

export interface CreateCouponInput {
  code?: string;
  discountPercent: number;
  maxUses: number;
  isActive?: boolean;
}

export interface UpdateCouponInput {
  discountPercent?: number;
  maxUses?: number;
  isActive?: boolean;
}

export interface ListCouponsOptions {
  page: number;
  limit: number;
  sortBy: CouponSortField;
  sortOrder: "asc" | "desc";
  search?: string;
  isActive?: boolean;
}

export interface AppliedCoupon {
  couponId: string;
  code: string;
  discountPercent: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}
