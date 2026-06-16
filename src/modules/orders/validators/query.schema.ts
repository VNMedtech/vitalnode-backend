import { z } from "zod";
import { OrderStatus } from "../../../../generated/prisma/client.js";
import {
  ORDER_DEFAULT_LIMIT,
  ORDER_DEFAULT_PAGE,
  ORDER_MAX_LIMIT,
  ORDER_SORT_FIELDS,
} from "../constants/order.constants.js";

export const listOrdersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(ORDER_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(ORDER_MAX_LIMIT)
      .default(ORDER_DEFAULT_LIMIT),
    sortBy: z.enum(ORDER_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    status: z.nativeEnum(OrderStatus).optional(),
    search: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type ListOrdersQueryInput = z.infer<typeof listOrdersQuerySchema>;
