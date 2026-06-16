import { z } from "zod";
import {
  ADDRESS_DEFAULT_LIMIT,
  ADDRESS_DEFAULT_PAGE,
  ADDRESS_MAX_LIMIT,
  ADDRESS_SORT_FIELDS,
} from "../constants/address.constants.js";

export const listAddressesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(ADDRESS_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(ADDRESS_MAX_LIMIT)
      .default(ADDRESS_DEFAULT_LIMIT),
    sortBy: z.enum(ADDRESS_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type ListAddressesQueryInput = z.infer<typeof listAddressesQuerySchema>;
