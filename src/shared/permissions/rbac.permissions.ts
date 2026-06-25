/**
 * RBAC permission definitions and role-to-permission mappings.
 */
import { UserRole } from "../enums/userRole.enum.js";

export const permissions = {
  users: {
    readProfile: "users:read-profile",
    updateProfile: "users:update-profile",
    changePassword: "users:change-password",
    list: "users:list",
    read: "users:read",
    update: "users:update",
    disable: "users:disable",
    enable: "users:enable",
    delete: "users:delete",
    stats: "users:stats",
    activity: "users:activity",
  },
  categories: {
    create: "categories:create",
    read: "categories:read",
    update: "categories:update",
    delete: "categories:delete",
  },
  sellers: {
    approve: "sellers:approve",
    reject: "sellers:reject",
    disable: "sellers:disable",
    enable: "sellers:enable",
    read: "sellers:read",
  },
  products: {
    create: "products:create",
    read: "products:read",
    update: "products:update",
    delete: "products:delete",
    approve: "products:approve",
    reject: "products:reject",
  },
  inventory: {
    read: "inventory:read",
    update: "inventory:update",
  },
  addresses: {
    read: "addresses:read",
    create: "addresses:create",
    update: "addresses:update",
    delete: "addresses:delete",
    setDefault: "addresses:set-default",
  },
  cart: {
    read: "cart:read",
    mutate: "cart:mutate",
  },
  orders: {
    create: "orders:create",
    read: "orders:read",
    cancel: "orders:cancel",
    assignDelivery: "orders:assign-delivery",
    updateStatus: "orders:update-status",
  },
  payments: {
    create: "payments:create",
    verify: "payments:verify",
    read: "payments:read",
    refund: "payments:refund",
  },
  uploads: {
    create: "uploads:create",
    delete: "uploads:delete",
  },
  notifications: {
    read: "notifications:read",
  },
  analytics: {
    read: "analytics:read",
  },
  salesReports: {
    read: "sales-reports:read",
  },
  auditLogs: {
    read: "audit-logs:read",
  },
  reviews: {
    create: "reviews:create",
    update: "reviews:update",
    delete: "reviews:delete",
    manage: "reviews:manage",
  },
  admin: {
    manage: "admin:manage",
  },
  settlements: {
    read: "settlements:read",
    manage: "settlements:manage",
  },
  deliveryPartners: {
    read: "delivery-partners:read",
    manage: "delivery-partners:manage",
  },
} as const;

type PermissionGroups = typeof permissions;
type PermissionValues<T> = T extends Record<string, infer U> ? U : never;

export type Permission =
  PermissionValues<PermissionGroups[keyof PermissionGroups]> extends infer U
    ? U extends string
      ? U
      : never
    : never;

const allPermissions = Object.values(permissions).flatMap((group) =>
  Object.values(group),
) as Permission[];

export const rolePermissions: Record<UserRole, readonly Permission[]> = {
  [UserRole.ADMIN]: allPermissions,
  [UserRole.BUYER]: [
    permissions.users.readProfile,
    permissions.users.updateProfile,
    permissions.users.changePassword,
    permissions.categories.read,
    permissions.products.read,
    permissions.addresses.read,
    permissions.addresses.create,
    permissions.addresses.update,
    permissions.addresses.delete,
    permissions.addresses.setDefault,
    permissions.cart.read,
    permissions.cart.mutate,
    permissions.orders.create,
    permissions.orders.read,
    permissions.orders.cancel,
    permissions.payments.create,
    permissions.payments.verify,
    permissions.payments.read,
    permissions.uploads.create,
    permissions.uploads.delete,
    permissions.notifications.read,
    permissions.reviews.create,
    permissions.reviews.update,
    permissions.reviews.delete,
  ],
  /** Maximum seller permissions — only granted when approvalStatus is ACTIVE. */
  [UserRole.SELLER]: [
    permissions.users.readProfile,
    permissions.users.updateProfile,
    permissions.users.changePassword,
    permissions.categories.read,
    permissions.products.create,
    permissions.products.read,
    permissions.products.update,
    permissions.products.delete,
    permissions.inventory.read,
    permissions.inventory.update,
    permissions.orders.read,
    permissions.orders.cancel,
    permissions.orders.updateStatus,
    permissions.salesReports.read,
    permissions.settlements.read,
    permissions.payments.read,
    permissions.uploads.create,
    permissions.uploads.delete,
    permissions.notifications.read,
  ],
  [UserRole.DELIVERY_PARTNER]: [
    permissions.users.readProfile,
    permissions.users.updateProfile,
    permissions.users.changePassword,
    permissions.orders.read,
    permissions.orders.updateStatus,
    permissions.uploads.create,
    permissions.notifications.read,
    permissions.deliveryPartners.read,
  ],
};

export function roleHasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  return rolePermissions[role].includes(permission);
}

export function rolesHavePermission(
  roles: readonly UserRole[],
  permission: Permission,
): boolean {
  return roles.some((role) => roleHasPermission(role, permission));
}
