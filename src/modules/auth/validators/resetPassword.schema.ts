import { z } from "zod";
import { strongPasswordSchema } from "../../../shared/validators/password.schema.js";

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  newPassword: strongPasswordSchema,
});
