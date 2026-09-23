import { z } from "zod";
import {
  TECH_BLOG_CATEGORY_MAX_LENGTH,
  TECH_BLOG_CONTENT_MAX_LENGTH,
  TECH_BLOG_DEFAULT_LIMIT,
  TECH_BLOG_DEFAULT_PAGE,
  TECH_BLOG_MAX_LIMIT,
  TECH_BLOG_MAX_TAGS,
  TECH_BLOG_SHORT_DESCRIPTION_MAX_LENGTH,
  TECH_BLOG_SLUG_MAX_LENGTH,
  TECH_BLOG_SORT_FIELDS,
  TECH_BLOG_STATUSES,
  TECH_BLOG_TAG_MAX_LENGTH,
  TECH_BLOG_TITLE_MAX_LENGTH,
} from "../constants/techBlog.constants.js";

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(TECH_BLOG_SLUG_MAX_LENGTH)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(TECH_BLOG_TAG_MAX_LENGTH),
  )
  .max(TECH_BLOG_MAX_TAGS)
  .optional();

export const createTechBlogBodySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(TECH_BLOG_TITLE_MAX_LENGTH),
    slug: slugSchema.optional(),
    shortDescription: z
      .string()
      .trim()
      .min(1, "Short description is required")
      .max(TECH_BLOG_SHORT_DESCRIPTION_MAX_LENGTH),
    category: z
      .string()
      .trim()
      .min(1, "Category is required")
      .max(TECH_BLOG_CATEGORY_MAX_LENGTH),
    tags: tagsSchema,
    featuredImageUrl: z.string().url().nullable().optional(),
    featuredImageUploadId: z.string().uuid().nullable().optional(),
    content: z
      .string()
      .trim()
      .min(1, "Blog content is required")
      .max(TECH_BLOG_CONTENT_MAX_LENGTH),
    publishDate: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .optional(),
    isFeatured: z.boolean().optional(),
    status: z.enum(TECH_BLOG_STATUSES).optional(),
  })
  .strict();

export type CreateTechBlogBody = z.infer<typeof createTechBlogBodySchema>;

export const updateTechBlogBodySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(TECH_BLOG_TITLE_MAX_LENGTH)
      .optional(),
    slug: slugSchema.optional(),
    shortDescription: z
      .string()
      .trim()
      .min(1)
      .max(TECH_BLOG_SHORT_DESCRIPTION_MAX_LENGTH)
      .optional(),
    category: z
      .string()
      .trim()
      .min(1)
      .max(TECH_BLOG_CATEGORY_MAX_LENGTH)
      .optional(),
    tags: tagsSchema,
    featuredImageUrl: z.string().url().nullable().optional(),
    featuredImageUploadId: z.string().uuid().nullable().optional(),
    content: z
      .string()
      .trim()
      .min(1)
      .max(TECH_BLOG_CONTENT_MAX_LENGTH)
      .optional(),
    publishDate: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .optional(),
    isFeatured: z.boolean().optional(),
    status: z.enum(TECH_BLOG_STATUSES).optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "At least one field must be provided" },
  );

export type UpdateTechBlogBody = z.infer<typeof updateTechBlogBodySchema>;

export const listTechBlogsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(TECH_BLOG_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(TECH_BLOG_MAX_LIMIT)
      .default(TECH_BLOG_DEFAULT_LIMIT),
    sortBy: z.enum(TECH_BLOG_SORT_FIELDS).default("publishDate"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().trim().min(1).max(120).optional(),
    category: z.string().trim().min(1).max(TECH_BLOG_CATEGORY_MAX_LENGTH).optional(),
    tag: z.string().trim().min(1).max(TECH_BLOG_TAG_MAX_LENGTH).optional(),
    status: z.enum(TECH_BLOG_STATUSES).optional(),
    featuredOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((value) =>
        value === undefined ? undefined : value === "true",
      ),
  })
  .strict();

export type ListTechBlogsQueryInput = z.infer<typeof listTechBlogsQuerySchema>;

export const techBlogIdParamSchema = z
  .object({
    id: z.string().uuid("Invalid blog ID"),
  })
  .strict();

export type TechBlogIdParam = z.infer<typeof techBlogIdParamSchema>;

export const techBlogSlugParamSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(TECH_BLOG_SLUG_MAX_LENGTH),
  })
  .strict();

export type TechBlogSlugParam = z.infer<typeof techBlogSlugParamSchema>;
