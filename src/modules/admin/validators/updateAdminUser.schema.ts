import { z } from "zod";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";

export const updateAdminUserBodySchema = z
  .object({
    firstName: z.string().min(1).max(80).trim().optional(),
    lastName: z.string().min(1).max(80).trim().optional(),
    email: z.string().email().max(255).trim().toLowerCase().optional(),
    phoneNumber: z.string().min(8).max(20).trim().nullable().optional(),
    status: z.nativeEnum(UserStatus).optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.firstName !== undefined ||
      data.lastName !== undefined ||
      data.email !== undefined ||
      data.phoneNumber !== undefined ||
      data.status !== undefined,
    { message: "At least one field must be provided" },
  );

export type UpdateAdminUserBody = z.infer<typeof updateAdminUserBodySchema>;
