/**
 * Shared TypeScript types used across modules.
 */
import type { SellerApprovalStatus } from "../enums/sellerApprovalStatus.enum.js";
import type { UserRole } from "../enums/userRole.enum.js";

export interface PaginationQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email: string;
  /** Present when role is SELLER — drives approval-gated permission checks. */
  sellerApprovalStatus?: SellerApprovalStatus;
  /** Present when the user must change their password before other protected actions. */
  mustChangePassword?: boolean;
}
