import { z } from "zod";

export const createDeliveryPartnerBodySchema = z
  .object({
    email: z.string().email().trim().toLowerCase(),
    firstName: z.string().min(1).max(80).trim(),
    lastName: z.string().min(1).max(80).trim(),
    phoneNumber: z.string().min(8).max(20).trim().optional(),
    addressLine1: z.string().min(1).max(200).trim(),
    addressLine2: z.string().min(1).max(200).trim().optional(),
    city: z.string().min(1).max(100).trim(),
    state: z.string().min(1).max(100).trim(),
    country: z.string().min(1).max(100).trim(),
    postalCode: z.string().min(1).max(20).trim(),
  })
  .strict();

export type CreateDeliveryPartnerBody = z.infer<
  typeof createDeliveryPartnerBodySchema
>;
