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
  buyerProfile: {
    id: string;
    buyerType: string;
    addresses: Array<{
      id: string;
      name: string;
      phone: string;
      addressLine1: string;
      addressLine2: string | null;
      city: string;
      state: string;
      country: string;
      postalCode: string;
      isDefault: boolean;
    }>;
  } | null;
  sellerProfile: {
    id: string;
    businessName: string;
    contactPerson: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    approvalStatus: string;
    commissionPercentage: { toString(): string } | null;
  } | null;
  deliveryPartnerProfile: {
    id: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    country: string;
    postalCode: string;
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
      buyerProfile: user.buyerProfile
        ? {
            id: user.buyerProfile.id,
            buyerType: user.buyerProfile.buyerType,
            addresses: user.buyerProfile.addresses,
          }
        : null,
      sellerProfile: user.sellerProfile
        ? {
            id: user.sellerProfile.id,
            businessName: user.sellerProfile.businessName,
            contactPerson: user.sellerProfile.contactPerson,
            addressLine1: user.sellerProfile.addressLine1,
            addressLine2: user.sellerProfile.addressLine2,
            city: user.sellerProfile.city,
            state: user.sellerProfile.state,
            country: user.sellerProfile.country,
            postalCode: user.sellerProfile.postalCode,
            approvalStatus: user.sellerProfile.approvalStatus,
            commissionPercentage:
              user.sellerProfile.commissionPercentage?.toString() ?? null,
          }
        : null,
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
