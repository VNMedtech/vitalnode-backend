/**
 * JWT authentication middleware — validates access token and attaches user to request.
 */
import type { RequestHandler } from "express";
import { prisma } from "../infrastructure/prisma/client.js";
import {
  ForbiddenError,
  UnauthorizedError,
} from "../shared/errors/app.errors.js";
import {
  isDisabledDeliveryPartnerFulfillmentRoute,
  isDisabledSellerFulfillmentRoute,
} from "../shared/constants/disabledAccountFulfillment.constants.js";
import { SellerApprovalStatus } from "../shared/enums/sellerApprovalStatus.enum.js";
import { UserRole } from "../shared/enums/userRole.enum.js";
import { UserStatus } from "../shared/enums/userStatus.enum.js";
import { verifyAccessToken } from "../utils/jwt.util.js";
import { getSellerAccessDeniedMessage } from "../shared/permissions/seller.permissions.js";

const PASSWORD_CHANGE_ALLOWED_PATHS = new Set([
  "/api/v1/users/me/change-password",
  "/api/v1/auth/logout",
]);

function isPasswordChangeAllowedRoute(
  originalUrl: string,
  method: string,
): boolean {
  const path = originalUrl.split("?")[0] ?? originalUrl;

  if (PASSWORD_CHANGE_ALLOWED_PATHS.has(path)) {
    return true;
  }

  // Allow read-only profile access while password change is mandatory.
  return method === "GET" && path === "/api/v1/users/me";
}

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Access token is required");
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();

  if (!token) {
    throw new UnauthorizedError("Access token is required");
  }

  return token;
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findFirst({
      where: {
        id: payload.sub,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        mustChangePassword: true,
        sellerProfile: {
          select: {
            approvalStatus: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    if (user.status !== UserStatus.ACTIVE) {
      const role = user.role as UserRole;
      const allowsDisabledDeliveryFulfillment =
        role === UserRole.DELIVERY_PARTNER &&
        isDisabledDeliveryPartnerFulfillmentRoute(
          req.originalUrl,
          req.method,
        );

      if (!allowsDisabledDeliveryFulfillment) {
        throw new ForbiddenError("Account is disabled");
      }
    }

    const role = user.role as UserRole;
    let sellerApprovalStatus: SellerApprovalStatus | undefined;

    if (role === UserRole.SELLER) {
      if (!user.sellerProfile) {
        throw new ForbiddenError("Seller profile not found");
      }
      sellerApprovalStatus =
        user.sellerProfile.approvalStatus as SellerApprovalStatus;

      if (
        sellerApprovalStatus === SellerApprovalStatus.DISABLED &&
        !isDisabledSellerFulfillmentRoute(req.originalUrl, req.method)
      ) {
        throw new ForbiddenError(
          getSellerAccessDeniedMessage(SellerApprovalStatus.DISABLED),
        );
      }
    }

    if (
      user.mustChangePassword &&
      !isPasswordChangeAllowedRoute(req.originalUrl, req.method)
    ) {
      throw new ForbiddenError("Password change required before accessing this resource");
    }

    req.user = {
      id: user.id,
      email: user.email,
      role,
      sellerApprovalStatus,
      ...(user.mustChangePassword ? { mustChangePassword: true } : {}),
    };

    next();
  } catch (error) {
    next(error);
  }
};
