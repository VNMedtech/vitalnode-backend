import { z } from "zod";

export const subAdminIdParamSchema = z
  .object({
    id: z.string().uuid("Invalid sub-admin ID"),
  })
  .strict();

export type SubAdminIdParam = z.infer<typeof subAdminIdParamSchema>;
