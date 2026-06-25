export const ADMIN_USER_DEFAULT_PAGE = 1;
export const ADMIN_USER_DEFAULT_LIMIT = 20;
export const ADMIN_USER_MAX_LIMIT = 100;
export const ADMIN_USER_SEARCH_MAX_LENGTH = 120;
export const ADMIN_USER_ACTIVITY_DEFAULT_LIMIT = 10;

export const ADMIN_USER_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "email",
  "firstName",
  "lastName",
  "role",
  "status",
] as const;

export type AdminUserSortField = (typeof ADMIN_USER_SORT_FIELDS)[number];

export const ADMIN_USER_VERIFICATION_STATUSES = [
  "VERIFIED",
  "PASSWORD_CHANGE_REQUIRED",
  "SELLER_PENDING_APPROVAL",
  "SELLER_REJECTED",
  "ACCOUNT_DISABLED",
] as const;

export type AdminUserVerificationStatus =
  (typeof ADMIN_USER_VERIFICATION_STATUSES)[number];

export const ADMIN_USER_AUDIT_ENTITY_TYPE = "USER" as const;

export const ADMIN_USER_ACTIONS = {
  UPDATE: "ADMIN_USER_UPDATE",
  DISABLE: "ADMIN_USER_DISABLE",
  ENABLE: "ADMIN_USER_ENABLE",
  DELETE: "ADMIN_USER_DELETE",
} as const;
