export const ADDRESS_AUDIT_ENTITY_TYPE = "ADDRESS" as const;

export const ADDRESS_ACTIONS = {
  CREATE: "ADDRESS_CREATE",
  UPDATE: "ADDRESS_UPDATE",
  DELETE: "ADDRESS_DELETE",
  SET_DEFAULT: "ADDRESS_SET_DEFAULT",
} as const;

export const ADDRESS_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "recipientName",
  "city",
  "isDefault",
] as const;

export type AddressSortField = (typeof ADDRESS_SORT_FIELDS)[number];

export const ADDRESS_DEFAULT_PAGE = 1;
export const ADDRESS_DEFAULT_LIMIT = 20;
export const ADDRESS_MAX_LIMIT = 100;

export const ADDRESS_RECIPIENT_NAME_MAX_LENGTH = 120;
export const ADDRESS_PHONE_MAX_LENGTH = 20;
export const ADDRESS_LINE_MAX_LENGTH = 200;
export const ADDRESS_CITY_MAX_LENGTH = 100;
export const ADDRESS_STATE_MAX_LENGTH = 100;
export const ADDRESS_COUNTRY_MAX_LENGTH = 100;
export const ADDRESS_POSTAL_CODE_MAX_LENGTH = 20;
