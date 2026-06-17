import { z } from "zod";
import {
  ANALYTICS_DEFAULT_LIMIT,
  ANALYTICS_DEFAULT_PAGE,
  ANALYTICS_INVENTORY_ALERT_FILTERS,
  ANALYTICS_MAX_LIMIT,
  ANALYTICS_REVENUE_GROUP_BY,
} from "../constants/analytics.constants.js";

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

const analyticsDateRangeQuerySchema = z
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

export const dashboardQuerySchema = z.object({}).strict();

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;

export const userStatisticsQuerySchema = analyticsDateRangeQuerySchema;

export type UserStatisticsQueryInput = z.infer<
  typeof userStatisticsQuerySchema
>;

export const sellerStatisticsQuerySchema = analyticsDateRangeQuerySchema;

export type SellerStatisticsQueryInput = z.infer<
  typeof sellerStatisticsQuerySchema
>;

export const productStatisticsQuerySchema = analyticsDateRangeQuerySchema;

export type ProductStatisticsQueryInput = z.infer<
  typeof productStatisticsQuerySchema
>;

export const orderStatisticsQuerySchema = analyticsDateRangeQuerySchema;

export type OrderStatisticsQueryInput = z.infer<
  typeof orderStatisticsQuerySchema
>;

export const revenueStatisticsQuerySchema = analyticsDateRangeQuerySchema
  .extend({
    groupBy: z.enum(ANALYTICS_REVENUE_GROUP_BY).default("day"),
  })
  .strict();

export type RevenueStatisticsQueryInput = z.infer<
  typeof revenueStatisticsQuerySchema
>;

export const inventoryAlertsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(ANALYTICS_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(ANALYTICS_MAX_LIMIT)
      .default(ANALYTICS_DEFAULT_LIMIT),
    alertStatus: z.enum(ANALYTICS_INVENTORY_ALERT_FILTERS).default("ALL"),
  })
  .strict();

export type InventoryAlertsQueryInput = z.infer<
  typeof inventoryAlertsQuerySchema
>;
