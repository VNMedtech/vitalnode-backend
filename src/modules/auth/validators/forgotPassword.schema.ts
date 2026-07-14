import { z } from "zod";
import { AuthPortal } from "../../../shared/enums/authPortal.enum.js";

const AUTH_PORTAL_VALUES = Object.values(AuthPortal) as [string, ...string[]];

export const forgotPasswordBodySchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  portal: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.enum(AUTH_PORTAL_VALUES))
    .optional(),
});

export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
