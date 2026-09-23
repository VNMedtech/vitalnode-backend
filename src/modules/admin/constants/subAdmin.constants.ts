export const SUB_ADMIN_DEFAULT_PAGE = 1;
export const SUB_ADMIN_DEFAULT_LIMIT = 20;
export const SUB_ADMIN_MAX_LIMIT = 100;
export const SUB_ADMIN_SEARCH_MAX_LENGTH = 120;

export const SUB_ADMIN_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "email",
  "firstName",
  "lastName",
  "status",
] as const;

export type SubAdminSortField = (typeof SUB_ADMIN_SORT_FIELDS)[number];

export const SUB_ADMIN_AUDIT_ENTITY_TYPE = "SUB_ADMIN" as const;

export const SUB_ADMIN_ACTIONS = {
  CREATE: "SUB_ADMIN_CREATE",
  UPDATE: "SUB_ADMIN_UPDATE",
  DISABLE: "SUB_ADMIN_DISABLE",
  ENABLE: "SUB_ADMIN_ENABLE",
  DELETE: "SUB_ADMIN_DELETE",
} as const;

export const SUB_ADMIN_NOTIFICATION_TYPES = {
  CREATED: "SUB_ADMIN_CREATED",
} as const;
