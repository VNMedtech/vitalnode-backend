import { z } from "zod";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import {
  DELIVERY_PARTNER_DEFAULT_LIMIT,
  DELIVERY_PARTNER_DEFAULT_PAGE,
  DELIVERY_PARTNER_MAX_LIMIT,
  DELIVERY_PARTNER_SEARCH_MAX_LENGTH,
  DELIVERY_PARTNER_SORT_FIELDS,
} from "../constants/deliveryPartner.constants.js";

export const listDeliveryPartnersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(DELIVERY_PARTNER_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(DELIVERY_PARTNER_MAX_LIMIT)
      .default(DELIVERY_PARTNER_DEFAULT_LIMIT),
    sortBy: z.enum(DELIVERY_PARTNER_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    search: z
      .string()
      .trim()
      .min(1)
      .max(DELIVERY_PARTNER_SEARCH_MAX_LENGTH)
      .optional(),
    status: z.nativeEnum(UserStatus).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    state: z.string().trim().min(1).max(120).optional(),
    country: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type ListDeliveryPartnersQueryInput = z.infer<
  typeof listDeliveryPartnersQuerySchema
>;
