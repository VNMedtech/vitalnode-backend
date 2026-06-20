import { z } from "zod";
import {
  SALES_REPORTS_DEFAULT_LIMIT,
  SALES_REPORTS_DEFAULT_PAGE,
  SALES_REPORTS_DEFAULT_TOP_PRODUCTS_LIMIT,
  SALES_REPORTS_MAX_LIMIT,
  SALES_REPORTS_MAX_TOP_PRODUCTS_LIMIT,
  SALES_REPORTS_REVENUE_GROUP_BY,
} from "../constants/sales-reports.constants.js";

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

const salesReportPeriodQuerySchema = z
  .object({
    from: isoDateString.optional(),
    to: isoDateString.optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
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
  )
  .refine(
    (value) => {
      const hasCalendar = value.month !== undefined || value.year !== undefined;
      const hasRange = value.from !== undefined || value.to !== undefined;
      if (hasCalendar && hasRange) {
        return false;
      }
      return true;
    },
    {
      message:
        "Use either `from`/`to` date range or `month`/`year` calendar filters, not both",
      path: ["from"],
    },
  );

export const sellerSalesSummaryQuerySchema = salesReportPeriodQuerySchema
  .extend({
    topProductsLimit: z.coerce
      .number()
      .int()
      .min(1)
      .max(SALES_REPORTS_MAX_TOP_PRODUCTS_LIMIT)
      .default(SALES_REPORTS_DEFAULT_TOP_PRODUCTS_LIMIT),
  })
  .strict();

export type SellerSalesSummaryQueryInput = z.infer<
  typeof sellerSalesSummaryQuerySchema
>;

export const sellerOrdersSummaryQuerySchema = salesReportPeriodQuerySchema;

export type SellerOrdersSummaryQueryInput = z.infer<
  typeof sellerOrdersSummaryQuerySchema
>;

export const sellerRevenueSummaryQuerySchema = salesReportPeriodQuerySchema
  .extend({
    groupBy: z.enum(SALES_REPORTS_REVENUE_GROUP_BY).default("day"),
  })
  .strict();

export type SellerRevenueSummaryQueryInput = z.infer<
  typeof sellerRevenueSummaryQuerySchema
>;

export const platformSalesReportQuerySchema = salesReportPeriodQuerySchema;

export type PlatformSalesReportQueryInput = z.infer<
  typeof platformSalesReportQuerySchema
>;

export const sellerSalesReportQuerySchema = salesReportPeriodQuerySchema
  .extend({
    page: z.coerce.number().int().min(1).default(SALES_REPORTS_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(SALES_REPORTS_MAX_LIMIT)
      .default(SALES_REPORTS_DEFAULT_LIMIT),
  })
  .strict();

export type SellerSalesReportQueryInput = z.infer<
  typeof sellerSalesReportQuerySchema
>;

export interface ResolvedSalesReportPeriod {
  from?: Date;
  to?: Date;
}

export function resolveSalesReportPeriod(input: {
  from?: Date;
  to?: Date;
  month?: number;
  year?: number;
}): ResolvedSalesReportPeriod {
  if (input.month !== undefined || input.year !== undefined) {
    const year = input.year ?? new Date().getUTCFullYear();

    if (input.month !== undefined) {
      const from = new Date(Date.UTC(year, input.month - 1, 1, 0, 0, 0, 0));
      const to = new Date(Date.UTC(year, input.month, 0, 23, 59, 59, 999));
      return { from, to };
    }

    const from = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    return { from, to };
  }

  return { from: input.from, to: input.to };
}
