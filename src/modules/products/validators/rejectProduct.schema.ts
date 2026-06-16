import { z } from "zod";
import { PRODUCT_REASON_MAX_LENGTH } from "../constants/product.constants.js";

export const rejectProductBodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1)
      .max(PRODUCT_REASON_MAX_LENGTH)
      .optional(),
  })
  .strict()
  .default({});

export type RejectProductBody = z.infer<typeof rejectProductBodySchema>;
