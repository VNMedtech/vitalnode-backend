import { z } from "zod";
import { strongPasswordSchema } from "../../../shared/validators/password.schema.js";

export const registerSellerBodySchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: strongPasswordSchema,
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
