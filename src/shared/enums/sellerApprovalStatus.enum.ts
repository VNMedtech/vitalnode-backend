/**
 * Seller approval lifecycle — mirrors Prisma SellerApprovalStatus.
 * Domain docs use APPROVED; persisted value is ACTIVE.
 */
export enum SellerApprovalStatus {
  PENDING_APPROVAL = "PENDING_APPROVAL",
  /** Approved seller — domain equivalent of APPROVED */
  ACTIVE = "ACTIVE",
  REJECTED = "REJECTED",
  DISABLED = "DISABLED",
}
