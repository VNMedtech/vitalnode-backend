import { z } from "zod";
import {
  MARKETPLACE_TEASER_TYPES,
  TEASER_CTA_LABEL_MAX,
  TEASER_CTA_URL_MAX,
  TEASER_DEFAULT_LIMIT,
  TEASER_DEFAULT_PAGE,
  TEASER_MAX_LIMIT,
  TEASER_SUMMARY_MAX,
  TEASER_TITLE_MAX,
} from "../constants/marketplaceTeaser.constants.js";

const optionalUrl = z
  .string()
  .trim()
  .max(TEASER_CTA_URL_MAX)
  .url()
  .nullable()
  .optional();

const optionalDate = z
  .union([
    z.string().datetime({ offset: true }),
    z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
    z.null(),
  ])
  .optional();

export const createTeaserBodySchema = z
  .object({
    type: z.enum(MARKETPLACE_TEASER_TYPES),
    title: z.string().trim().min(1).max(TEASER_TITLE_MAX),
    summary: z.string().trim().min(1).max(TEASER_SUMMARY_MAX),
    imageUrl: z.string().url().nullable().optional(),
    imageUploadId: z.string().uuid().nullable().optional(),
    expectedAt: optionalDate,
    ctaLabel: z
      .string()
      .trim()
      .max(TEASER_CTA_LABEL_MAX)
      .nullable()
      .optional(),
    ctaUrl: optionalUrl,
    isPublished: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict();

export type CreateTeaserBody = z.infer<typeof createTeaserBodySchema>;

export const updateTeaserBodySchema = z
  .object({
    type: z.enum(MARKETPLACE_TEASER_TYPES).optional(),
    title: z.string().trim().min(1).max(TEASER_TITLE_MAX).optional(),
    summary: z.string().trim().min(1).max(TEASER_SUMMARY_MAX).optional(),
    imageUrl: z.string().url().nullable().optional(),
    imageUploadId: z.string().uuid().nullable().optional(),
    expectedAt: optionalDate,
    ctaLabel: z
      .string()
      .trim()
      .max(TEASER_CTA_LABEL_MAX)
      .nullable()
      .optional(),
    ctaUrl: optionalUrl,
    isPublished: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "At least one field must be provided" },
  );

export type UpdateTeaserBody = z.infer<typeof updateTeaserBodySchema>;

export const teaserIdParamSchema = z
  .object({ id: z.string().uuid("Invalid teaser ID") })
  .strict();

export type TeaserIdParam = z.infer<typeof teaserIdParamSchema>;

export const listTeasersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(TEASER_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(TEASER_MAX_LIMIT)
      .default(TEASER_DEFAULT_LIMIT),
    type: z.enum(MARKETPLACE_TEASER_TYPES).optional(),
    search: z.string().trim().min(1).max(TEASER_TITLE_MAX).optional(),
    isPublished: z
      .enum(["true", "false"])
      .optional()
      .transform((value) =>
        value === undefined ? undefined : value === "true",
      ),
  })
  .strict();

export type ListTeasersQuery = z.infer<typeof listTeasersQuerySchema>;

export const listPublicTeasersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(TEASER_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(TEASER_MAX_LIMIT)
      .default(TEASER_DEFAULT_LIMIT),
    type: z.enum(MARKETPLACE_TEASER_TYPES),
    search: z.string().trim().min(1).max(TEASER_TITLE_MAX).optional(),
  })
  .strict();

export type ListPublicTeasersQuery = z.infer<
  typeof listPublicTeasersQuerySchema
>;
