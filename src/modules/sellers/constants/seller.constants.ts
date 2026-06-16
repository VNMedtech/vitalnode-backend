import { SELLER_APPROVAL_TRANSITIONS as SELLER_APPROVAL_TRANSITION_MAP } from "../../../shared/stateMachine/sellerApproval.guard.js";

export const SELLER_AUDIT_ENTITY_TYPE = "SELLER" as const;

export const SELLER_ACTIONS = {
  APPROVE: "SELLER_APPROVE",
  REJECT: "SELLER_REJECT",
  DISABLE: "SELLER_DISABLE",
  ENABLE: "SELLER_ENABLE",
} as const;

export const SELLER_SORT_FIELDS = [
  "businessName",
  "createdAt",
  "updatedAt",
  "approvalStatus",
] as const;

export type SellerSortField = (typeof SELLER_SORT_FIELDS)[number];

export const SELLER_DEFAULT_PAGE = 1;
export const SELLER_DEFAULT_LIMIT = 20;
export const SELLER_MAX_LIMIT = 100;
export const SELLER_SEARCH_MAX_LENGTH = 120;
export const SELLER_REASON_MAX_LENGTH = 500;

export const SELLER_APPROVAL_TRANSITIONS = SELLER_APPROVAL_TRANSITION_MAP;

export const SELLER_NOTIFICATION_TYPES = {
  APPROVED: "SELLER_APPROVED",
  REJECTED: "SELLER_REJECTED",
  DISABLED: "SELLER_DISABLED",
  ENABLED: "SELLER_ENABLED",
} as const;
