/**
 * Maps admin portal modules to the existing fine-grained RBAC permissions.
 * A sub-admin assigned a module receives every permission in that module.
 */
import {
  ADMIN_MODULE_VALUES,
  type AdminModule,
} from "../enums/adminModule.enum.js";
import { permissions, type Permission } from "./rbac.permissions.js";

const adminAccountPermissions = [
  permissions.users.readProfile,
  permissions.users.updateProfile,
  permissions.users.changePassword,
  permissions.notifications.read,
  permissions.uploads.create,
  permissions.uploads.delete,
] as const satisfies readonly Permission[];

export const adminModulePermissions: Record<
  AdminModule,
  readonly Permission[]
> = {
  USERS: [
    permissions.users.list,
    permissions.users.read,
    permissions.users.update,
    permissions.users.disable,
    permissions.users.enable,
    permissions.users.delete,
    permissions.users.stats,
    permissions.users.activity,
    permissions.sellers.read,
    permissions.sellers.approve,
    permissions.sellers.reject,
    permissions.sellers.disable,
    permissions.sellers.enable,
    permissions.deliveryPartners.read,
    permissions.deliveryPartners.manage,
  ],
  PRODUCTS_APPROVE: [
    permissions.products.read,
    permissions.products.approve,
    permissions.products.reject,
  ],
  PRODUCTS_MANAGE: [
    permissions.products.read,
    permissions.products.update,
    permissions.products.delete,
  ],
  TEMPLATES: [
    permissions.productTemplates.read,
    permissions.productTemplates.manage,
  ],
  ORDERS: [
    permissions.orders.read,
    permissions.orders.cancel,
    permissions.orders.assignDelivery,
    permissions.orders.updateStatus,
    permissions.payments.read,
    permissions.payments.refund,
    permissions.invoices.read,
  ],
  SETTLEMENTS: [
    permissions.settlements.read,
    permissions.settlements.manage,
  ],
  INVENTORY: [permissions.inventory.read, permissions.inventory.update],
  CATEGORIES: [
    permissions.categories.create,
    permissions.categories.read,
    permissions.categories.update,
    permissions.categories.delete,
  ],
  REVIEWS: [permissions.reviews.manage, permissions.reviews.delete],
  DP_REVIEWS: [
    permissions.deliveryPartnerReviews.read,
    permissions.deliveryPartnerReviews.manage,
  ],
  AUDIT: [permissions.auditLogs.read],
  REPORTS: [permissions.analytics.read, permissions.salesReports.read],
  TECH_BLOG: [
    permissions.techBlogs.create,
    permissions.techBlogs.read,
    permissions.techBlogs.update,
    permissions.techBlogs.delete,
    permissions.techBlogs.publish,
  ],
  COMPANY_CONTENT: [
    permissions.companyContent.read,
    permissions.companyContent.manage,
  ],
  COUPONS: [
    permissions.coupons.create,
    permissions.coupons.read,
    permissions.coupons.update,
  ],
  MARKETPLACE_TEASERS: [
    permissions.marketplaceTeasers.read,
    permissions.marketplaceTeasers.manage,
  ],
};

export function resolveAdminModulePermissions(
  modules: readonly AdminModule[] | undefined,
): ReadonlySet<Permission> {
  const granted = new Set<Permission>(adminAccountPermissions);
  if (!modules?.length) {
    return granted;
  }

  for (const module of modules) {
    const modulePermissions = adminModulePermissions[module];
    if (!modulePermissions) {
      continue;
    }
    for (const permission of modulePermissions) {
      granted.add(permission);
    }
  }

  return granted;
}

export function subAdminHasPermission(
  modules: readonly AdminModule[] | undefined,
  permission: Permission,
): boolean {
  return resolveAdminModulePermissions(modules).has(permission);
}

export function isAssignableAdminModule(value: string): value is AdminModule {
  return (ADMIN_MODULE_VALUES as readonly string[]).includes(value);
}
