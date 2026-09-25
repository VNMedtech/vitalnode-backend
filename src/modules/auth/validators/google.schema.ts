import { z } from "zod";
import { BuyerType } from "../../../../generated/prisma/client.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { nmcRegistrationNumberSchema } from "../../../shared/validators/nmcRegistrationNumber.schema.js";

const idTokenSchema = z.string().min(20);

export const googleLoginBodySchema = z.object({
  idToken: idTokenSchema,
  role: z.enum([UserRole.BUYER, UserRole.SELLER]),
});

export const googleRegisterBuyerBodySchema = z
  .object({
    idToken: idTokenSchema,
    firstName: z.string().min(1).max(80).trim(),
    lastName: z.string().min(1).max(80).trim(),
    phoneNumber: z.string().min(8).max(20).trim().optional(),
    buyerType: z.nativeEnum(BuyerType),
    nmcRegistrationNumber: nmcRegistrationNumberSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.buyerType === BuyerType.DOCTOR) {
      if (!data.nmcRegistrationNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nmcRegistrationNumber"],
          message: "NMC registration number is required for doctors",
        });
      }
      return;
    }

    if (data.nmcRegistrationNumber !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nmcRegistrationNumber"],
        message: "NMC registration number is only allowed for doctors",
      });
    }
  });

export const googleRegisterSellerBodySchema = z.object({
  idToken: idTokenSchema,
  firstName: z.string().min(1).max(80).trim(),
  lastName: z.string().min(1).max(80).trim(),
  phoneNumber: z.string().min(8).max(20).trim().optional(),
  businessName: z.string().min(1).max(160).trim(),
  contactPerson: z.string().min(1).max(160).trim(),
  addressLine1: z.string().min(1).max(200).trim(),
  addressLine2: z.string().min(1).max(200).trim().optional(),
  city: z.string().min(1).max(100).trim(),
  state: z.string().min(1).max(100).trim(),
  country: z.string().min(1).max(100).trim(),
  postalCode: z.string().min(1).max(20).trim(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
