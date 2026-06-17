import { z } from "zod";

export const auditLogParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export type AuditLogParamsInput = z.infer<typeof auditLogParamsSchema>;

