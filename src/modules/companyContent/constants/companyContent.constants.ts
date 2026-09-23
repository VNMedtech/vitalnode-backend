export const COMPANY_CONTENT_AUDIT_ENTITY = {
  WHY: "WHY_VITALNODE",
  MEMBER: "COMPANY_MEMBER",
} as const;

export const COMPANY_CONTENT_ACTIONS = {
  WHY_UPDATE: "WHY_VITALNODE_UPDATE",
  MEMBER_CREATE: "COMPANY_MEMBER_CREATE",
  MEMBER_UPDATE: "COMPANY_MEMBER_UPDATE",
  MEMBER_DELETE: "COMPANY_MEMBER_DELETE",
} as const;

export const COMPANY_MEMBER_TYPES = ["FOUNDER", "TEAM"] as const;
export type CompanyMemberTypeValue = (typeof COMPANY_MEMBER_TYPES)[number];

export const WHY_SECTION_ID = "why-vitalnode";
export const WHY_CARD_MAX = 12;
export const MEMBER_NAME_MAX = 120;
export const MEMBER_ROLE_MAX = 120;
export const MEMBER_BIO_MAX = 2000;
