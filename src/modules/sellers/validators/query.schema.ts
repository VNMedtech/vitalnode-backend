import { z } from "zod";
import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import {
  SELLER_DEFAULT_LIMIT,
  SELLER_DEFAULT_PAGE,
  SELLER_MAX_LIMIT,
  SELLER_SEARCH_MAX_LENGTH,
  SELLER_SORT_FIELDS,
} from "../constants/seller.constants.js";

export const listSellersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(SELLER_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(SELLER_MAX_LIMIT)
      .default(SELLER_DEFAULT_LIMIT),
    sortBy: z.enum(SELLER_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().trim().min(1).max(SELLER_SEARCH_MAX_LENGTH).optional(),
    companyName: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().min(1).max(120).optional(),
    approvalStatus: z.nativeEnum(SellerApprovalStatus).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    state: z.string().trim().min(1).max(120).optional(),
    country: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type ListSellersQueryInput = z.infer<typeof listSellersQuerySchema>;
