/**
 * Shared domain enums — mirrors Prisma enums where applicable.
 */

export enum UserRole {
  ADMIN = "ADMIN",
  SUB_ADMIN = "SUB_ADMIN",
  BUYER = "BUYER",
  SELLER = "SELLER",
  DELIVERY_PARTNER = "DELIVERY_PARTNER",
}

export function isAdminPortalRole(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUB_ADMIN;
}
