/**
 * Blocks seller business routes unless approvalStatus is ACTIVE.
 * Use alongside authenticate for routes that only check role today.
 */
import type { RequestHandler } from "express";
import {
  ForbiddenError,
  UnauthorizedError,
} from "../shared/errors/app.errors.js";
import { isDisabledSellerFulfillmentRoute } from "../shared/constants/disabledAccountFulfillment.constants.js";
import { SellerApprovalStatus } from "../shared/enums/sellerApprovalStatus.enum.js";
import { UserRole } from "../shared/enums/userRole.enum.js";
import { getSellerAccessDeniedMessage } from "../shared/permissions/seller.permissions.js";

export const requireApprovedSeller: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  if (req.user.role !== UserRole.SELLER) {
    next(new ForbiddenError("Seller access required"));
    return;
  }

  const status =
    req.user.sellerApprovalStatus ?? SellerApprovalStatus.PENDING_APPROVAL;

  const allowsDisabledFulfillment =
    status === SellerApprovalStatus.DISABLED &&
    isDisabledSellerFulfillmentRoute(req.originalUrl, req.method);

  if (
    status !== SellerApprovalStatus.ACTIVE &&
    !allowsDisabledFulfillment
  ) {
    next(new ForbiddenError(getSellerAccessDeniedMessage(status)));
    return;
  }

  next();
};
