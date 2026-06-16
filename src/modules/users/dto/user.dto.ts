import { z } from "zod";

export const buyerProfileSummaryDtoSchema = z.object({
  id: z.string().uuid(),
  buyerType: z.string(),
});

export const sellerProfileSummaryDtoSchema = z.object({
  id: z.string().uuid(),
  businessName: z.string(),
  approvalStatus: z.string(),
});

export const deliveryPartnerProfileSummaryDtoSchema = z.object({
  id: z.string().uuid(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
});

export const userProfileDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.string(),
  status: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phoneNumber: z.string().nullable(),
  profileImage: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  buyerProfile: buyerProfileSummaryDtoSchema.nullable(),
  sellerProfile: sellerProfileSummaryDtoSchema.nullable(),
  deliveryPartnerProfile: deliveryPartnerProfileSummaryDtoSchema.nullable(),
});

export type UserProfileDtoSchema = z.infer<typeof userProfileDtoSchema>;
