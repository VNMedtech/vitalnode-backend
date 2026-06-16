import { SellerApprovalStatus } from "../enums/sellerApprovalStatus.enum.js";

export const SELLER_APPROVAL_TRANSITIONS: Readonly<
  Record<SellerApprovalStatus, readonly SellerApprovalStatus[]>
> = {
  [SellerApprovalStatus.PENDING_APPROVAL]: [
    SellerApprovalStatus.ACTIVE,
    SellerApprovalStatus.REJECTED,
  ],
  [SellerApprovalStatus.ACTIVE]: [SellerApprovalStatus.DISABLED],
  [SellerApprovalStatus.DISABLED]: [SellerApprovalStatus.ACTIVE],
  [SellerApprovalStatus.REJECTED]: [],
};

export function canTransitionSellerApproval(
  from: SellerApprovalStatus,
  to: SellerApprovalStatus,
): boolean {
  return SELLER_APPROVAL_TRANSITIONS[from].includes(to);
}

export function assertSellerApprovalTransition(
  from: SellerApprovalStatus,
  to: SellerApprovalStatus,
): void {
  if (!canTransitionSellerApproval(from, to)) {
    throw new Error(
      `Invalid seller approval transition: ${from} -> ${to}`,
    );
  }
}
