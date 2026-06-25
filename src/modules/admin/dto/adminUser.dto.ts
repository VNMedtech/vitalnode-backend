import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import type { AdminUserVerificationStatus } from "../constants/adminUser.constants.js";
import type {
  AdminUserActivityActionDto,
  AdminUserActivityDto,
  AdminUserActivityOrderDto,
  AdminUserActivitySessionDto,
  AdminUserDetailDto,
  AdminUserListItemDto,
  AdminUserStatsDto,
} from "../types/adminUser.types.js";

type UserListRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  role: string;
  status: string;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
  sellerProfile: { approvalStatus: string } | null;
};

type UserDetailRecord = UserListRecord & {
  profileImage: string | null;
  buyerProfile: { id: string; buyerType: string } | null;
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

export function resolveVerificationStatus(user: {
  role: string;
  status: string;
  mustChangePassword: boolean;
  sellerProfile: { approvalStatus: string } | null;
}): AdminUserVerificationStatus {
  if (user.mustChangePassword) {
    return "PASSWORD_CHANGE_REQUIRED";
  }

  if (user.role === "SELLER" && user.sellerProfile) {
    const approval = user.sellerProfile.approvalStatus;
    if (approval === SellerApprovalStatus.PENDING_APPROVAL) {
      return "SELLER_PENDING_APPROVAL";
    }
    if (approval === SellerApprovalStatus.REJECTED) {
      return "SELLER_REJECTED";
    }
    if (approval === SellerApprovalStatus.DISABLED) {
      return "ACCOUNT_DISABLED";
    }
  }

  if (user.status === UserStatus.DISABLED) {
    return "ACCOUNT_DISABLED";
  }

  return "VERIFIED";
}

export function toAdminUserListItemDto(user: UserListRecord): AdminUserListItemDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    role: user.role,
    status: user.status,
    verificationStatus: resolveVerificationStatus(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toAdminUserDetailDto(
  user: UserDetailRecord,
  counts: { addressesCount: number; ordersCount: number },
  lastLoginAt: Date | null,
): AdminUserDetailDto {
  return {
    profile: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      profileImage: user.profileImage,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      buyerProfile: user.buyerProfile,
      sellerProfile: user.sellerProfile,
      deliveryPartnerProfile: user.deliveryPartnerProfile,
    },
    addressesCount: counts.addressesCount,
    ordersCount: counts.ordersCount,
    accountStatus: user.status,
    lastLoginAt,
    registrationDate: user.createdAt,
    verificationStatus: resolveVerificationStatus(user),
  };
}

export function toAdminUserStatsDto(stats: AdminUserStatsDto): AdminUserStatsDto {
  return stats;
}

export function toAdminUserActivityDto(input: {
  sessions: AdminUserActivitySessionDto[];
  orders: AdminUserActivityOrderDto[];
  actions: AdminUserActivityActionDto[];
}): AdminUserActivityDto {
  return {
    recentSessions: input.sessions,
    recentOrders: input.orders,
    recentActions: input.actions,
  };
}
