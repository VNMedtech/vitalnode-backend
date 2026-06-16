/**
 * Service-layer defense in depth for seller business operations.
 * Route middleware should already gate via authorizePermission; call this inside services too.
 */
import { ForbiddenError } from "../errors/app.errors.js";
import { SellerApprovalStatus } from "../enums/sellerApprovalStatus.enum.js";
import { getSellerAccessDeniedMessage } from "../permissions/seller.permissions.js";

export function assertApprovedSeller(
  approvalStatus: SellerApprovalStatus,
): void {
  if (approvalStatus !== SellerApprovalStatus.ACTIVE) {
    throw new ForbiddenError(getSellerAccessDeniedMessage(approvalStatus));
  }
}
