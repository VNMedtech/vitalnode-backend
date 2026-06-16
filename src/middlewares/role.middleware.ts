/**
 * RBAC authorization middleware — enforces role-based access on protected routes.
 */
import type { Request, RequestHandler } from "express";
import {
  ForbiddenError,
  UnauthorizedError,
} from "../shared/errors/app.errors.js";
import type { UserRole } from "../shared/enums/userRole.enum.js";
import {
  getSellerAccessDeniedMessage,
  isSellerOperationalPermission,
  userHasPermission,
  type Permission,
} from "../shared/permissions/index.js";
import { SellerApprovalStatus } from "../shared/enums/sellerApprovalStatus.enum.js";
import { UserRole as Role } from "../shared/enums/userRole.enum.js";

function forbiddenForSellerPermission(req: Request): ForbiddenError {
  const status =
    req.user?.sellerApprovalStatus ?? SellerApprovalStatus.PENDING_APPROVAL;
  return new ForbiddenError(getSellerAccessDeniedMessage(status));
}

export function authorize(allowedRoles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError("Authentication required"));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError("Insufficient permissions"));
      return;
    }

    next();
  };
}

export function authorizePermission(requiredPermission: Permission): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError("Authentication required"));
      return;
    }

    if (!userHasPermission(req.user, requiredPermission)) {
      if (
        req.user.role === Role.SELLER &&
        isSellerOperationalPermission(requiredPermission)
      ) {
        next(forbiddenForSellerPermission(req));
        return;
      }
      next(new ForbiddenError("Insufficient permissions"));
      return;
    }

    next();
  };
}

export function authorizeAnyPermission(
  requiredPermissions: Permission[],
): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError("Authentication required"));
      return;
    }

    const hasPermission = requiredPermissions.some((permission) =>
      userHasPermission(req.user!, permission),
    );

    if (!hasPermission) {
      const needsApprovedSeller = requiredPermissions.some(
        (permission) =>
          req.user!.role === Role.SELLER &&
          isSellerOperationalPermission(permission),
      );
      if (needsApprovedSeller) {
        next(forbiddenForSellerPermission(req));
        return;
      }
      next(new ForbiddenError("Insufficient permissions"));
      return;
    }

    next();
  };
}
