export const TECH_BLOG_AUDIT_ENTITY_TYPE = "TECH_BLOG" as const;

export const TECH_BLOG_ACTIONS = {
  CREATE: "TECH_BLOG_CREATE",
  UPDATE: "TECH_BLOG_UPDATE",
  PUBLISH: "TECH_BLOG_PUBLISH",
  UNPUBLISH: "TECH_BLOG_UNPUBLISH",
  DELETE: "TECH_BLOG_DELETE",
} as const;

export const TECH_BLOG_STATUSES = ["DRAFT", "PUBLISHED"] as const;

export type TechBlogStatusValue = (typeof TECH_BLOG_STATUSES)[number];

export const TECH_BLOG_SORT_FIELDS = [
  "title",
  "createdAt",
  "updatedAt",
  "publishDate",
] as const;

export type TechBlogSortField = (typeof TECH_BLOG_SORT_FIELDS)[number];

export const TECH_BLOG_DEFAULT_PAGE = 1;
export const TECH_BLOG_DEFAULT_LIMIT = 20;
export const TECH_BLOG_MAX_LIMIT = 100;
export const TECH_BLOG_TITLE_MAX_LENGTH = 200;
export const TECH_BLOG_SLUG_MAX_LENGTH = 220;
export const TECH_BLOG_SHORT_DESCRIPTION_MAX_LENGTH = 500;
export const TECH_BLOG_CATEGORY_MAX_LENGTH = 100;
export const TECH_BLOG_TAG_MAX_LENGTH = 50;
export const TECH_BLOG_MAX_TAGS = 20;
export const TECH_BLOG_CONTENT_MAX_LENGTH = 500_000;
