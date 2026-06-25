import { z } from "zod";

export const disableAdminUserBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type DisableAdminUserBody = z.infer<typeof disableAdminUserBodySchema>;

export const enableAdminUserBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type EnableAdminUserBody = z.infer<typeof enableAdminUserBodySchema>;
