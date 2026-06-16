import { z } from "zod";
import {
  NOTIFICATION_DEFAULT_LIMIT,
  NOTIFICATION_DEFAULT_PAGE,
  NOTIFICATION_MAX_LIMIT,
  NOTIFICATION_SORT_FIELDS,
  NOTIFICATION_TYPES,
} from "../constants/notification.constants.js";

const notificationTypeValues = Object.values(NOTIFICATION_TYPES);

export const listNotificationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(NOTIFICATION_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(NOTIFICATION_MAX_LIMIT)
      .default(NOTIFICATION_DEFAULT_LIMIT),
    sortBy: z.enum(NOTIFICATION_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    isRead: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    type: z.enum(notificationTypeValues as [string, ...string[]]).optional(),
  })
  .strict();

export type ListNotificationsQueryInput = z.infer<
  typeof listNotificationsQuerySchema
>;
