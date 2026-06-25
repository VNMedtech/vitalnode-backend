import type { UserRole } from "../../../shared/enums/userRole.enum.js";
import type { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import type {
  AdminUserSortField,
  AdminUserVerificationStatus,
} from "../constants/adminUser.constants.js";

export interface ListAdminUsersQuery {
  page: number;
  limit: number;
  sortBy: AdminUserSortField;
  sortOrder: "asc" | "desc";
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  verificationStatus?: AdminUserVerificationStatus;
  from?: Date;
  to?: Date;
}

export interface UpdateAdminUserInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string | null;
  status?: UserStatus;
}

export interface DisableAdminUserInput {
  reason?: string;
}

export interface EnableAdminUserInput {
  reason?: string;
}

export interface AdminUserListItemDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  role: string;
  status: string;
  verificationStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserDetailDto {
  profile: {
    id: string;
    email: string;
    role: string;
    status: string;
    mustChangePassword: boolean;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    profileImage: string | null;
    createdAt: Date;
    updatedAt: Date;
    buyerProfile: {
      id: string;
      buyerType: string;
    } | null;
    sellerProfile: {
      id: string;
      businessName: string;
      approvalStatus: string;
    } | null;
    deliveryPartnerProfile: {
      id: string;
      city: string;
      state: string;
      country: string;
    } | null;
  };
  addressesCount: number;
  ordersCount: number;
  accountStatus: string;
  lastLoginAt: Date | null;
  registrationDate: Date;
  verificationStatus: string;
}

export interface AdminUserStatsDto {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  buyersCount: number;
  sellersCount: number;
  deliveryPartnersCount: number;
}

export interface AdminUserActivitySessionDto {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AdminUserActivityOrderDto {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  createdAt: Date;
}

export interface AdminUserActivityActionDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: Date;
}

export interface AdminUserActivityDto {
  recentSessions: AdminUserActivitySessionDto[];
  recentOrders: AdminUserActivityOrderDto[];
  recentActions: AdminUserActivityActionDto[];
}
