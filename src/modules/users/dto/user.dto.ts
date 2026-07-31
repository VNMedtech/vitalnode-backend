import { z } from "zod";

export const buyerProfileSummaryDtoSchema = z.object({
  id: z.string().uuid(),
  buyerType: z.string(),
  nmcRegistrationNumber: z.string().nullable(),
});

export const sellerProfileSummaryDtoSchema = z.object({
  id: z.string().uuid(),
  businessName: z.string(),
  contactPerson: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  postalCode: z.string(),
  approvalStatus: z.string(),
  commissionPercentage: z.string().nullable(),
});

export const deliveryPartnerProfileSummaryDtoSchema = z.object({
  id: z.string().uuid(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  postalCode: z.string(),
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
