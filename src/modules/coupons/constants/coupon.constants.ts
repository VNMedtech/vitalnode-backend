export const COUPON_AUDIT_ENTITY_TYPE = "COUPON" as const;

export const COUPON_ACTIONS = {
  CREATE: "COUPON_CREATE",
  UPDATE: "COUPON_UPDATE",
  DEACTIVATE: "COUPON_DEACTIVATE",
  VALIDATE: "COUPON_VALIDATE",
  REDEEM: "COUPON_REDEEM",
  RELEASE: "COUPON_RELEASE",
} as const;

export const COUPON_DEFAULT_PAGE = 1;
export const COUPON_DEFAULT_LIMIT = 20;
export const COUPON_MAX_LIMIT = 100;
export const COUPON_CODE_MIN_LENGTH = 4;
export const COUPON_CODE_MAX_LENGTH = 32;
export const COUPON_GENERATED_CODE_LENGTH = 8;
export const COUPON_SORT_FIELDS = ["createdAt", "code", "usedCount"] as const;

export type CouponSortField = (typeof COUPON_SORT_FIELDS)[number];
