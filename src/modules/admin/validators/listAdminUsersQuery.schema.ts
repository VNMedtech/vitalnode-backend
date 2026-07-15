import { z } from "zod";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import {
  isoDateFromSchema,
  isoDateToSchema,
} from "../../../shared/validators/dateRange.schema.js";
import {
  ADMIN_USER_DEFAULT_LIMIT,
  ADMIN_USER_DEFAULT_PAGE,
  ADMIN_USER_MAX_LIMIT,
  ADMIN_USER_SEARCH_MAX_LENGTH,
  ADMIN_USER_SORT_FIELDS,
  ADMIN_USER_VERIFICATION_STATUSES,
} from "../constants/adminUser.constants.js";

export const listAdminUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(ADMIN_USER_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(ADMIN_USER_MAX_LIMIT)
      .default(ADMIN_USER_DEFAULT_LIMIT),
    sortBy: z.enum(ADMIN_USER_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    search: z
      .string()
      .trim()
      .min(1)
      .max(ADMIN_USER_SEARCH_MAX_LENGTH)
      .optional(),
    role: z.nativeEnum(UserRole).optional(),
    status: z.nativeEnum(UserStatus).optional(),
    verificationStatus: z.enum(ADMIN_USER_VERIFICATION_STATUSES).optional(),
    from: isoDateFromSchema.optional(),
    to: isoDateToSchema.optional(),
  })
  .strict()
  .refine(
    (value) => {
      if (value.from && value.to) {
        return value.from <= value.to;
      }
      return true;
    },
    { message: "`from` must be before or equal to `to`", path: ["from"] },
  );

export type ListAdminUsersQueryInput = z.infer<typeof listAdminUsersQuerySchema>;
