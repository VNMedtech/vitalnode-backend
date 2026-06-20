/**
 * Seller approval–aware permission resolution.
 * Operational seller permissions require ACTIVE (approved) status.
 */
import { SellerApprovalStatus } from "../enums/sellerApprovalStatus.enum.js";
import { UserRole } from "../enums/userRole.enum.js";
import {
  permissions,
  roleHasPermission,
  type Permission,
} from "./rbac.permissions.js";

/** Permissions every seller account may hold regardless of approval status. */
export const sellerAccountPermissions = [
  permissions.users.readProfile,
  permissions.users.changePassword,
  permissions.notifications.read,
] as const satisfies readonly Permission[];

/** Granted only while admin review is pending. */
export const sellerPendingApprovalPermissions = [
  permissions.users.updateProfile,
] as const satisfies readonly Permission[];

/**
 * Seller business operations — products, inventory, orders, uploads.
 * Future modules should gate mutations with these permissions via authorizePermission.
 */
export const sellerOperationalPermissions = [
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
  permissions.uploads.create,
  permissions.uploads.delete,
] as const satisfies readonly Permission[];

const sellerPendingApprovalSet = new Set<Permission>([
  ...sellerAccountPermissions,
  ...sellerPendingApprovalPermissions,
]);

const sellerRejectedOrDisabledSet = new Set<Permission>([
  ...sellerAccountPermissions,
]);

const sellerApprovedSet = new Set<Permission>([
  ...sellerAccountPermissions,
  ...sellerPendingApprovalPermissions,
  ...sellerOperationalPermissions,
]);

export function isSellerOperationalPermission(
  permission: Permission,
): boolean {
  return (sellerOperationalPermissions as readonly Permission[]).includes(
    permission,
  );
}

export function resolveSellerPermissions(
  approvalStatus: SellerApprovalStatus,
): ReadonlySet<Permission> {
  switch (approvalStatus) {
    case SellerApprovalStatus.ACTIVE:
      return sellerApprovedSet;
    case SellerApprovalStatus.PENDING_APPROVAL:
      return sellerPendingApprovalSet;
    case SellerApprovalStatus.REJECTED:
    case SellerApprovalStatus.DISABLED:
      return sellerRejectedOrDisabledSet;
    default: {
      const exhaustive: never = approvalStatus;
      return exhaustive;
    }
  }
}

export function sellerHasPermission(
  approvalStatus: SellerApprovalStatus,
  permission: Permission,
): boolean {
  return resolveSellerPermissions(approvalStatus).has(permission);
}

export interface PermissionSubject {
  role: UserRole;
  sellerApprovalStatus?: SellerApprovalStatus;
}

export function userHasPermission(
  subject: PermissionSubject,
  permission: Permission,
): boolean {
  if (subject.role === UserRole.SELLER) {
    if (!subject.sellerApprovalStatus) {
      return false;
    }
    return sellerHasPermission(subject.sellerApprovalStatus, permission);
  }

  return roleHasPermission(subject.role, permission);
}

export function getSellerAccessDeniedMessage(
  approvalStatus: SellerApprovalStatus,
): string {
  switch (approvalStatus) {
    case SellerApprovalStatus.PENDING_APPROVAL:
      return "Seller account is pending admin approval";
    case SellerApprovalStatus.REJECTED:
      return "Seller account has been rejected";
    case SellerApprovalStatus.DISABLED:
      return "Seller account has been disabled";
    default:
      return "Seller account is not approved for this action";
  }
}
