import { z } from "zod";
import { SELLER_REASON_MAX_LENGTH } from "../constants/seller.constants.js";

export const rejectSellerBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(SELLER_REASON_MAX_LENGTH).optional(),
  })
  .strict()
  .default({});

export type RejectSellerBody = z.infer<typeof rejectSellerBodySchema>;
