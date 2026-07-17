import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .min(1, "Value cannot be empty")
  .max(255)
  .optional()
  .nullable();

export const saveTrackingBodySchema = z
  .object({
    carrier: optionalTrimmed,
    awbNumber: optionalTrimmed,
    trackingUrl: z
      .string()
      .trim()
      .url("trackingUrl must be a valid URL")
      .max(2048)
      .optional()
      .nullable(),
  })
  .strict()
  .refine(
    (body) =>
      body.carrier !== undefined ||
      body.awbNumber !== undefined ||
      body.trackingUrl !== undefined,
    { message: "At least one tracking field is required" },
  );

export type SaveTrackingBody = z.infer<typeof saveTrackingBodySchema>;
