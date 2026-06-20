export const SALES_REPORTS_DEFAULT_PAGE = 1;
export const SALES_REPORTS_DEFAULT_LIMIT = 20;
export const SALES_REPORTS_MAX_LIMIT = 100;

export const SALES_REPORTS_DEFAULT_TOP_PRODUCTS_LIMIT = 10;
export const SALES_REPORTS_MAX_TOP_PRODUCTS_LIMIT = 50;

export const SALES_REPORTS_REVENUE_GROUP_BY = ["day", "week", "month"] as const;

export type SalesReportsRevenueGroupBy =
  (typeof SALES_REPORTS_REVENUE_GROUP_BY)[number];
