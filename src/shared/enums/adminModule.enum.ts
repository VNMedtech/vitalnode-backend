/**
 * Admin portal modules that can be assigned to a sub-admin.
 * Full access is granted for every assigned module.
 */
export const ADMIN_MODULE_VALUES = [
  "USERS",
  "PRODUCTS_APPROVE",
  "PRODUCTS_MANAGE",
  "TEMPLATES",
  "ORDERS",
  "SETTLEMENTS",
  "INVENTORY",
  "CATEGORIES",
  "REVIEWS",
  "DP_REVIEWS",
  "AUDIT",
  "REPORTS",
  "TECH_BLOG",
  "COMPANY_CONTENT",
  "COUPONS",
  "MARKETPLACE_TEASERS",
] as const;

export type AdminModule = (typeof ADMIN_MODULE_VALUES)[number];

export const ADMIN_MODULE_CATALOG: ReadonlyArray<{
  id: AdminModule;
  label: string;
  description: string;
}> = [
  {
    id: "USERS",
    label: "Manage Users",
    description: "Onboard, approve, disable, and inspect buyers, sellers, and delivery partners",
  },
  {
    id: "PRODUCTS_APPROVE",
    label: "Approve Products",
    description: "Review, approve, and reject seller product listings",
  },
  {
    id: "PRODUCTS_MANAGE",
    label: "Product Management",
    description: "Edit and disable catalog products across sellers",
  },
  {
    id: "TEMPLATES",
    label: "Product Templates",
    description: "Create and maintain product attribute templates",
  },
  {
    id: "ORDERS",
    label: "Monitor Orders",
    description: "Track orders, assign delivery, update status, and handle proofs",
  },
  {
    id: "SETTLEMENTS",
    label: "Settlements",
    description: "Create settlement batches and disburse seller payouts",
  },
  {
    id: "INVENTORY",
    label: "Inventory",
    description: "View and adjust stock levels and low-stock alerts",
  },
  {
    id: "CATEGORIES",
    label: "Manage Categories",
    description: "Create, update, and delete catalog categories",
  },
  {
    id: "REVIEWS",
    label: "Review Moderation",
    description: "Moderate buyer product reviews",
  },
  {
    id: "DP_REVIEWS",
    label: "DP Reviews",
    description: "Moderate delivery partner reviews",
  },
  {
    id: "AUDIT",
    label: "Audit Trail",
    description: "Inspect platform audit logs",
  },
  {
    id: "REPORTS",
    label: "View Reports",
    description: "View analytics dashboards and sales reports",
  },
  {
    id: "TECH_BLOG",
    label: "Tech Blog",
    description: "Create, edit, publish, and manage Tech Blog posts",
  },
  {
    id: "COMPANY_CONTENT",
    label: "Company Content",
    description: "Manage Why Vitalnode, founder profiles, and team info",
  },
  {
    id: "COUPONS",
    label: "Coupons",
    description: "Create and manage buyer discount coupon codes",
  },
  {
    id: "MARKETPLACE_TEASERS",
    label: "Coming Soon",
    description: "Manage marketplace coming-soon products and platform updates",
  },
];
