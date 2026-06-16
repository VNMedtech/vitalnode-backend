/**
 * uploads — uploadParams.schema
 * Zod schemas for upload route params validation.
 */
import { z } from "zod";

export const uploadIdParamSchema = z
  .object({
    id: z.uuid("Invalid upload ID"),
  })
  .strict();

export type UploadIdParam = z.infer<typeof uploadIdParamSchema>;
