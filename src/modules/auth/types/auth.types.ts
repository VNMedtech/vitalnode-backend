import type { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import type { UserRole } from "../../../shared/enums/userRole.enum.js";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUserDto {
  id: string;
  email: string;
  role: UserRole;
  sellerApprovalStatus?: SellerApprovalStatus;
  mustChangePassword?: boolean;
}

export interface LoginResultDto extends TokenPair {
  user: AuthenticatedUserDto;
}

/**
 * auth — auth.types
 * Module-specific TypeScript types and interfaces.
 */

export type authTypes = Record<string, unknown>;
