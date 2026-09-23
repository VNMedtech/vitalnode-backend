/**
 * Shared TypeScript types used across modules.
 */
import type { AdminModule } from "../enums/adminModule.enum.js";
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
  /** Present when role is SUB_ADMIN — drives module-gated permission checks. */
  adminModules?: AdminModule[];
  /** Present when the user must change their password before other protected actions. */
  mustChangePassword?: boolean;
}
