/**
 * uploads — signedUrlQuery.schema
 * Zod schema for signed URL query parameters.
 */
import { z } from "zod";

export const signedUrlQuerySchema = z
  .object({
    expiresIn: z.coerce
      .number()
      .int()
      .min(60, "expiresIn must be at least 60 seconds")
      .max(86_400, "expiresIn must not exceed 86400 seconds")
      .optional(),
  })
  .strict();

export type SignedUrlQueryInput = z.infer<typeof signedUrlQuerySchema>;
