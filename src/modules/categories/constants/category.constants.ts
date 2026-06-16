export const CATEGORY_AUDIT_ENTITY_TYPE = "CATEGORY" as const;

export const CATEGORY_ACTIONS = {
  CREATE: "CATEGORY_CREATE",
  UPDATE: "CATEGORY_UPDATE",
  DISABLE: "CATEGORY_DISABLE",
} as const;

export const CATEGORY_SORT_FIELDS = [
  "name",
  "createdAt",
  "updatedAt",
] as const;

export type CategorySortField = (typeof CATEGORY_SORT_FIELDS)[number];

export const CATEGORY_DEFAULT_PAGE = 1;
export const CATEGORY_DEFAULT_LIMIT = 20;
export const CATEGORY_MAX_LIMIT = 100;
export const CATEGORY_NAME_MAX_LENGTH = 120;
