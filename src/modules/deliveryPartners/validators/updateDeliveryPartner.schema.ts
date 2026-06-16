import { z } from "zod";

export const updateDeliveryPartnerBodySchema = z
  .object({
    firstName: z.string().min(1).max(80).trim().optional(),
    lastName: z.string().min(1).max(80).trim().optional(),
    phoneNumber: z.string().min(8).max(20).trim().nullable().optional(),
    addressLine1: z.string().min(1).max(200).trim().optional(),
    addressLine2: z.string().min(1).max(200).trim().nullable().optional(),
    city: z.string().min(1).max(100).trim().optional(),
    state: z.string().min(1).max(100).trim().optional(),
    country: z.string().min(1).max(100).trim().optional(),
    postalCode: z.string().min(1).max(20).trim().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateDeliveryPartnerBody = z.infer<
  typeof updateDeliveryPartnerBodySchema
>;
