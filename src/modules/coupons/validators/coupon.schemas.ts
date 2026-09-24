import { z } from "zod";
import {
  COUPON_CODE_MAX_LENGTH,
  COUPON_CODE_MIN_LENGTH,
  COUPON_DEFAULT_LIMIT,
  COUPON_DEFAULT_PAGE,
  COUPON_MAX_LIMIT,
  COUPON_SORT_FIELDS,
} from "../constants/coupon.constants.js";

const couponCodeSchema = z
  .string()
  .trim()
  .min(COUPON_CODE_MIN_LENGTH)
  .max(COUPON_CODE_MAX_LENGTH)
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Coupon code may only contain letters, numbers, hyphens, and underscores",
  )
  .transform((value) => value.toUpperCase());

export const createCouponBodySchema = z
  .object({
    code: couponCodeSchema.optional(),
    discountPercent: z.coerce.number().gt(0).lte(100),
    maxUses: z.coerce.number().int().min(1).max(1_000_000),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateCouponBody = z.infer<typeof createCouponBodySchema>;

export const updateCouponBodySchema = z
  .object({
    discountPercent: z.coerce.number().gt(0).lte(100).optional(),
    maxUses: z.coerce.number().int().min(1).max(1_000_000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "At least one field must be provided" },
  );

export type UpdateCouponBody = z.infer<typeof updateCouponBodySchema>;

export const couponIdParamSchema = z
  .object({ id: z.string().uuid("Invalid coupon ID") })
  .strict();

export type CouponIdParam = z.infer<typeof couponIdParamSchema>;

export const listCouponsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(COUPON_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(COUPON_MAX_LIMIT)
      .default(COUPON_DEFAULT_LIMIT),
    sortBy: z.enum(COUPON_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().trim().min(1).max(COUPON_CODE_MAX_LENGTH).optional(),
    isActive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) =>
        value === undefined ? undefined : value === "true",
      ),
  })
  .strict();

export type ListCouponsQuery = z.infer<typeof listCouponsQuerySchema>;

export const validateCouponBodySchema = z
  .object({
    code: couponCodeSchema,
  })
  .strict();

export type ValidateCouponBody = z.infer<typeof validateCouponBodySchema>;
