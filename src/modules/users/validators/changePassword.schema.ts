import { z } from "zod";
import { strongPasswordSchema } from "../../../shared/validators/password.schema.js";

export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(72),
    newPassword: strongPasswordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
