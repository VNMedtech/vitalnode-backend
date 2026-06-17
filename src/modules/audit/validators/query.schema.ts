import { z } from "zod";
import {
  AUDIT_DEFAULT_LIMIT,
  AUDIT_DEFAULT_PAGE,
  AUDIT_MAX_LIMIT,
} from "../constants/audit.constants.js";

const isoDateString = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .transform((value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid date");
    }
    return date;
  });

const dateRangeSchema = z
  .object({
    from: isoDateString.optional(),
    to: isoDateString.optional(),
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

