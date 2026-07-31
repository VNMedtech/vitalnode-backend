import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import { PRODUCT_STATUS_TRANSITIONS as PRODUCT_STATUS_TRANSITION_MAP } from "../../../shared/stateMachine/productStatus.guard.js";

export const PRODUCT_AUDIT_ENTITY_TYPE = "PRODUCT" as const;

export const PRODUCT_ACTIONS = {
  CREATE: "PRODUCT_CREATE",
  UPDATE: "PRODUCT_UPDATE",
  DISABLE: "PRODUCT_DISABLE",
  ENABLE: "PRODUCT_ENABLE",
  APPROVE: "PRODUCT_APPROVE",
  REJECT: "PRODUCT_REJECT",
  ATTACH_TEMPLATE: "PRODUCT_ATTACH_TEMPLATE",
} as const;

export const PRODUCT_SORT_FIELDS = ["price", "newest"] as const;

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

/** Marketplace default when sort params are omitted: lowest price first. */
export const MARKETPLACE_DEFAULT_SORT_ORDER = [
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
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 5000;
export const PRODUCT_DETAILS_MAX_LENGTH = 10000;
export const PRODUCT_MAX_MEDIA = 20;
export const PRODUCT_MAX_DOCUMENTS = 10;
export const PRODUCT_MIN_CATEGORIES = 1;

export const PRODUCT_IMAGE_FIELD_NAME = "images";
export const PRODUCT_DOCUMENT_FIELD_NAME = "documents";
export const PRODUCT_DOCUMENT_TYPES_FIELD_NAME = "documentTypes";

export const PRODUCT_APPROVAL_TRANSITIONS = PRODUCT_STATUS_TRANSITION_MAP;

export const PRODUCT_NOTIFICATION_TYPES = {
  APPROVED: "PRODUCT_APPROVED",
  REJECTED: "PRODUCT_REJECTED",
} as const;

/** Statuses visible on the public marketplace (list + detail + compare). */
export const PRODUCT_PUBLIC_STATUSES: readonly ProductStatus[] = [
  ProductStatus.APPROVED,
  ProductStatus.OUT_OF_STOCK,
];

export const PRODUCT_COMPARE_MIN_COUNT = 2;
export const PRODUCT_COMPARE_MAX_COUNT = 4;

export const PRODUCT_EDITABLE_STATUSES: readonly ProductStatus[] = [
  ProductStatus.PENDING_APPROVAL,
  ProductStatus.APPROVED,
  ProductStatus.OUT_OF_STOCK,
  ProductStatus.DISABLED,
];

/** Core commerce/copy fields that force re-approval when changed on APPROVED products. */
export const PRODUCT_CORE_REAPPROVAL_FIELDS = [
  "productName",
  "brand",
  "model",
  "pricing",
  "moq",
  "description",
  "details",
  "media",
  "documents",
  "replaceMedia",
  "replaceDocuments",
] as const;
