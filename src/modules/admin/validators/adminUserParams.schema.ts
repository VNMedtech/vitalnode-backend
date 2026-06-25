import { z } from "zod";

export const adminUserIdParamSchema = z
  .object({
    id: z.string().uuid("Invalid user ID"),
  })
  .strict();

export type AdminUserIdParam = z.infer<typeof adminUserIdParamSchema>;
