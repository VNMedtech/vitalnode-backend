import { z } from "zod";
import { BuyerType } from "../../../../generated/prisma/client.js";
import { strongPasswordSchema } from "../../../shared/validators/password.schema.js";

export const registerBuyerBodySchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: strongPasswordSchema,
  firstName: z.string().min(1).max(80).trim(),
  lastName: z.string().min(1).max(80).trim(),
  phoneNumber: z.string().min(8).max(20).trim().optional(),
  buyerType: z.nativeEnum(BuyerType),
});
