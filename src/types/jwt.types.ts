/**
 * Global TypeScript type augmentations for JWT payloads.
 */
import type { SellerApprovalStatus } from "../shared/enums/sellerApprovalStatus.enum.js";
import type { UserRole } from "../shared/enums/userRole.enum.js";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  email: string;
  /** Included for sellers so clients can render approval state without an extra call. */
  sellerApprovalStatus?: SellerApprovalStatus;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
  iat?: number;
  exp?: number;
}

/** @deprecated Use AccessTokenPayload instead. */
export type JwtPayload = AccessTokenPayload;
