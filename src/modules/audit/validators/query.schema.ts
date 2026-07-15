import { z } from "zod";
import {
  isoDateFromSchema,
  isoDateToSchema,
} from "../../../shared/validators/dateRange.schema.js";
import {
  AUDIT_DEFAULT_LIMIT,
  AUDIT_DEFAULT_PAGE,
  AUDIT_MAX_LIMIT,
} from "../constants/audit.constants.js";

const dateRangeSchema = z
  .object({
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

export const listAuditLogsQuerySchema = dateRangeSchema
  .extend({
    page: z.coerce.number().int().min(1).default(AUDIT_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(AUDIT_MAX_LIMIT)
      .default(AUDIT_DEFAULT_LIMIT),

    actorUserId: z.string().uuid().optional(),
    entityType: z.string().min(1).max(100).optional(),
    entityId: z.string().min(1).max(100).optional(),
    action: z.string().min(1).max(200).optional(),
  })
  .strict();

export type ListAuditLogsQueryInput = z.infer<typeof listAuditLogsQuerySchema>;

