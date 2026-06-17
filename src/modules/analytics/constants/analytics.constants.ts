export const ANALYTICS_DEFAULT_PAGE = 1;
export const ANALYTICS_DEFAULT_LIMIT = 20;
export const ANALYTICS_MAX_LIMIT = 100;

export const ANALYTICS_INVENTORY_ALERT_FILTERS = [
  "ALL",
  "LOW_STOCK",
  "OUT_OF_STOCK",
] as const;

export type AnalyticsInventoryAlertFilter =
  (typeof ANALYTICS_INVENTORY_ALERT_FILTERS)[number];

export const ANALYTICS_REVENUE_GROUP_BY = ["day", "week", "month"] as const;

export type AnalyticsRevenueGroupBy =
  (typeof ANALYTICS_REVENUE_GROUP_BY)[number];
