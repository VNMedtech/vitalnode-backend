import { z } from "zod";
import {
  COMPANY_MEMBER_TYPES,
  MEMBER_BIO_MAX,
  MEMBER_NAME_MAX,
  MEMBER_ROLE_MAX,
  WHY_CARD_MAX,
} from "../constants/companyContent.constants.js";

const whyCardSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  iconKey: z.string().trim().max(40).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateWhyBodySchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    subtitle: z.string().trim().max(500).nullable().optional(),
    isPublished: z.boolean().optional(),
    cards: z.array(whyCardSchema).max(WHY_CARD_MAX).optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "At least one field must be provided" },
  );

export type UpdateWhyBody = z.infer<typeof updateWhyBodySchema>;

const socialUrlSchema = z
  .string()
  .trim()
  .max(500)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "Enter a full http or https link",
  })
  .nullable()
  .optional();

export const createMemberBodySchema = z
  .object({
    type: z.enum(COMPANY_MEMBER_TYPES),
    name: z.string().trim().min(1).max(MEMBER_NAME_MAX),
    role: z.string().trim().min(1).max(MEMBER_ROLE_MAX),
    bio: z.string().trim().max(MEMBER_BIO_MAX).nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
    imageUploadId: z.string().uuid().nullable().optional(),
    instagramUrl: socialUrlSchema,
    linkedinUrl: socialUrlSchema,
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateMemberBody = z.infer<typeof createMemberBodySchema>;

export const updateMemberBodySchema = z
  .object({
    type: z.enum(COMPANY_MEMBER_TYPES).optional(),
    name: z.string().trim().min(1).max(MEMBER_NAME_MAX).optional(),
    role: z.string().trim().min(1).max(MEMBER_ROLE_MAX).optional(),
    bio: z.string().trim().max(MEMBER_BIO_MAX).nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
    imageUploadId: z.string().uuid().nullable().optional(),
    instagramUrl: socialUrlSchema,
    linkedinUrl: socialUrlSchema,
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "At least one field must be provided" },
  );

export type UpdateMemberBody = z.infer<typeof updateMemberBodySchema>;

export const memberIdParamSchema = z
  .object({ id: z.string().uuid("Invalid member ID") })
  .strict();

export type MemberIdParam = z.infer<typeof memberIdParamSchema>;

export const listMembersQuerySchema = z
  .object({
    type: z.enum(COMPANY_MEMBER_TYPES).optional(),
  })
  .strict();

export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;
