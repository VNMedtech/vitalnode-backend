import { z } from "zod";
import { SELLER_REASON_MAX_LENGTH } from "../constants/seller.constants.js";

export const disableSellerBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(SELLER_REASON_MAX_LENGTH).optional(),
  })
  .strict()
  .default({});

export type DisableSellerBody = z.infer<typeof disableSellerBodySchema>;
