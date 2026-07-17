import { z } from "zod";
import {
  SELLER_ADDRESS_DEFAULT_LIMIT,
  SELLER_ADDRESS_DEFAULT_PAGE,
  SELLER_ADDRESS_MAX_LIMIT,
  SELLER_ADDRESS_SORT_FIELDS,
} from "../constants/sellerAddress.constants.js";

export const listSellerAddressesQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int()
      .min(1)
      .default(SELLER_ADDRESS_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(SELLER_ADDRESS_MAX_LIMIT)
      .default(SELLER_ADDRESS_DEFAULT_LIMIT),
    sortBy: z.enum(SELLER_ADDRESS_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().trim().min(1).max(120).optional(),
    isActive: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
  })
  .strict();

export type ListSellerAddressesQueryInput = z.infer<
  typeof listSellerAddressesQuerySchema
>;
