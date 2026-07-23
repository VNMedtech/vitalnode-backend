import { z } from "zod";

export const attachTemplateBodySchema = z
  .object({
    templateId: z.string().uuid("Invalid template ID"),
    attributes: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type AttachTemplateBody = z.infer<typeof attachTemplateBodySchema>;
