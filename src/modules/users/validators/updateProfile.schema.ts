import { z } from "zod";

export const updateProfileBodySchema = z
  .object({
    firstName: z.string().min(1).max(80).trim().optional(),
    lastName: z.string().min(1).max(80).trim().optional(),
    phoneNumber: z.string().min(8).max(20).trim().nullable().optional(),
    profileImage: z.string().url().max(2048).nullable().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.firstName !== undefined ||
      data.lastName !== undefined ||
      data.phoneNumber !== undefined ||
      data.profileImage !== undefined,
    { message: "At least one profile field must be provided" },
  );

export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
