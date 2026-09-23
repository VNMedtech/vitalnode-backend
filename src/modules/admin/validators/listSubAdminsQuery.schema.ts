import { z } from "zod";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import {
  SUB_ADMIN_DEFAULT_LIMIT,
  SUB_ADMIN_DEFAULT_PAGE,
  SUB_ADMIN_MAX_LIMIT,
  SUB_ADMIN_SEARCH_MAX_LENGTH,
  SUB_ADMIN_SORT_FIELDS,
} from "../constants/subAdmin.constants.js";

export const listSubAdminsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(SUB_ADMIN_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(SUB_ADMIN_MAX_LIMIT)
      .default(SUB_ADMIN_DEFAULT_LIMIT),
    sortBy: z.enum(SUB_ADMIN_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    search: z
      .string()
      .trim()
      .min(1)
      .max(SUB_ADMIN_SEARCH_MAX_LENGTH)
      .optional(),
    status: z.nativeEnum(UserStatus).optional(),
  })
  .strict();

export type ListSubAdminsQueryInput = z.infer<typeof listSubAdminsQuerySchema>;
