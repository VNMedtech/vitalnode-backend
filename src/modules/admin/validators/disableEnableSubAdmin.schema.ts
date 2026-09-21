import { z } from "zod";

export const disableSubAdminBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type DisableSubAdminBody = z.infer<typeof disableSubAdminBodySchema>;

export const enableSubAdminBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type EnableSubAdminBody = z.infer<typeof enableSubAdminBodySchema>;
