import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import { PRODUCT_STATUS_TRANSITIONS as PRODUCT_STATUS_TRANSITION_MAP } from "../../../shared/stateMachine/productStatus.guard.js";

export const PRODUCT_AUDIT_ENTITY_TYPE = "PRODUCT" as const;

export const PRODUCT_ACTIONS = {
  CREATE: "PRODUCT_CREATE",
  UPDATE: "PRODUCT_UPDATE",
  DISABLE: "PRODUCT_DISABLE",
  APPROVE: "PRODUCT_APPROVE",
  REJECT: "PRODUCT_REJECT",
} as const;

export const PRODUCT_SORT_FIELDS = [
  "price",
  "newest",
  "deliveryTime",
] as const;

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

/** SOW marketplace default: lowest delivery days, then lowest price. */
export const MARKETPLACE_DEFAULT_SORT_ORDER = [
  { field: "deliveryTime", direction: "asc" },
  { field: "pricing", direction: "asc" },
] as const;

export const PRODUCT_DEFAULT_PAGE = 1;
export const PRODUCT_DEFAULT_LIMIT = 20;
export const PRODUCT_MAX_LIMIT = 100;
export const PRODUCT_SEARCH_MAX_LENGTH = 120;
export const PRODUCT_REASON_MAX_LENGTH = 500;
export const PRODUCT_NAME_MAX_LENGTH = 200;
export const PRODUCT_BRAND_MAX_LENGTH = 120;
export const PRODUCT_MODEL_MAX_LENGTH = 120;
export const PRODUCT_TYPE_MAX_LENGTH = 120;
export const PRODUCT_COLOR_MAX_LENGTH = 60;
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 5000;
export const PRODUCT_DETAILS_MAX_LENGTH = 10000;
export const PRODUCT_MAX_MEDIA = 20;
export const PRODUCT_MAX_DOCUMENTS = 10;

export const PRODUCT_IMAGE_FIELD_NAME = "images";
export const PRODUCT_DOCUMENT_FIELD_NAME = "documents";
export const PRODUCT_DOCUMENT_TYPES_FIELD_NAME = "documentTypes";

export const PRODUCT_APPROVAL_TRANSITIONS = PRODUCT_STATUS_TRANSITION_MAP;

export const PRODUCT_NOTIFICATION_TYPES = {
  APPROVED: "PRODUCT_APPROVED",
  REJECTED: "PRODUCT_REJECTED",
} as const;

export const PRODUCT_PUBLIC_STATUSES: readonly ProductStatus[] = [
  ProductStatus.APPROVED,
];

export const PRODUCT_COMPARE_MIN_COUNT = 2;
export const PRODUCT_COMPARE_MAX_COUNT = 4;

export const PRODUCT_EDITABLE_STATUSES: readonly ProductStatus[] = [
  ProductStatus.PENDING_APPROVAL,
  ProductStatus.APPROVED,
  ProductStatus.OUT_OF_STOCK,
  ProductStatus.DISABLED,
];
