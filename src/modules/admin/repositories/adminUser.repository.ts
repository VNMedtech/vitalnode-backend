import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import type {
  AdminUserSortField,
  AdminUserVerificationStatus,
} from "../constants/adminUser.constants.js";

const adminUserListSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phoneNumber: true,
  role: true,
  status: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
  sellerProfile: {
    select: {
      approvalStatus: true,
    },
  },
} satisfies Prisma.UserSelect;

const adminUserDetailSelect = {
  ...adminUserListSelect,
  profileImage: true,
  buyerProfile: {
    select: {
      id: true,
      buyerType: true,
    },
  },
  sellerProfile: {
    select: {
      id: true,
      businessName: true,
      approvalStatus: true,
    },
  },
  deliveryPartnerProfile: {
    select: {
      id: true,
      city: true,
      state: true,
      country: true,
    },
  },
} satisfies Prisma.UserSelect;

export type AdminUserListRecord = Prisma.UserGetPayload<{
  select: typeof adminUserListSelect;
}>;

export type AdminUserDetailRecord = Prisma.UserGetPayload<{
  select: typeof adminUserDetailSelect;
}>;

export interface FindAdminUsersOptions {
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

function buildVerificationStatusWhere(
  verificationStatus: AdminUserVerificationStatus,
): Prisma.UserWhereInput {
  switch (verificationStatus) {
    case "PASSWORD_CHANGE_REQUIRED":
      return { mustChangePassword: true };
    case "SELLER_PENDING_APPROVAL":
      return {
        role: UserRole.SELLER,
        sellerProfile: { approvalStatus: SellerApprovalStatus.PENDING_APPROVAL },
      };
    case "SELLER_REJECTED":
      return {
        role: UserRole.SELLER,
        sellerProfile: { approvalStatus: SellerApprovalStatus.REJECTED },
      };
    case "ACCOUNT_DISABLED":
      return {
        OR: [
          { status: UserStatus.DISABLED },
          {
            role: UserRole.SELLER,
            sellerProfile: { approvalStatus: SellerApprovalStatus.DISABLED },
          },
        ],
      };
    case "VERIFIED":
    default:
      return {
        mustChangePassword: false,
        status: UserStatus.ACTIVE,
        OR: [
          { role: UserRole.BUYER },
          { role: UserRole.DELIVERY_PARTNER },
          { role: UserRole.ADMIN },
          {
            role: UserRole.SELLER,
            sellerProfile: { approvalStatus: SellerApprovalStatus.ACTIVE },
          },
        ],
      };
  }
}

function buildAdminUsersWhere(
  options: Omit<FindAdminUsersOptions, "page" | "limit" | "sortBy" | "sortOrder">,
): Prisma.UserWhereInput {
  const { search, role, status, verificationStatus, from, to } = options;

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(verificationStatus
      ? buildVerificationStatusWhere(verificationStatus)
      : {}),
  };

  if (!search) {
    return where;
  }

  return {
    AND: [
      where,
      {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { phoneNumber: { contains: search, mode: "insensitive" } },
        ],
      },
    ],
  };
}

export class AdminUserRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  findUsers(options: FindAdminUsersOptions) {
    const { page, limit, sortBy, sortOrder } = options;
    const where = buildAdminUsersWhere(options);

    return this.prisma.user.findMany({
      where,
      select: adminUserListSelect,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  countUsers(
    options: Omit<FindAdminUsersOptions, "page" | "limit" | "sortBy" | "sortOrder">,
  ) {
    return this.prisma.user.count({
      where: buildAdminUsersWhere(options),
    });
  }

  findById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: adminUserDetailSelect,
    });
  }

  findByIdIncludingDeleted(id: string) {
    return this.prisma.user.findFirst({
      where: { id },
      select: adminUserDetailSelect,
    });
  }

  findByEmailExcludingUser(email: string, excludeUserId: string) {
    return this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
        id: { not: excludeUserId },
      },
      select: { id: true },
    });
  }

  findByPhoneExcludingUser(phoneNumber: string, excludeUserId: string) {
    return this.prisma.user.findFirst({
      where: {
        phoneNumber,
        deletedAt: null,
        id: { not: excludeUserId },
      },
      select: { id: true },
    });
  }

  updateUser(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phoneNumber?: string | null;
      status?: UserStatus;
    },
  ) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: adminUserDetailSelect,
    });
  }

  updateUserStatus(id: string, status: UserStatus) {
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: adminUserDetailSelect,
    });
  }

  softDeleteUser(id: string, deletedAt = new Date()) {
    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt,
        status: UserStatus.DISABLED,
      },
      select: adminUserDetailSelect,
    });
  }

  revokeAllActiveSessions(userId: string, revokedAt = new Date()) {
    return this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
  }

  updateSellerApprovalStatus(userId: string, approvalStatus: SellerApprovalStatus) {
    return this.prisma.sellerProfile.updateMany({
      where: { userId },
      data: { approvalStatus },
    });
  }

  countAddressesForUser(userId: string) {
    return this.prisma.address.count({
      where: {
        buyer: {
          userId,
        },
      },
    });
  }

  countOrdersForUser(userId: string) {
    return this.prisma.order.count({
      where: {
        OR: [
          { buyer: { userId } },
          { seller: { userId } },
        ],
      },
    });
  }

  findLastLoginAt(userId: string) {
    return this.prisma.authSession.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
  }

  findRecentSessions(userId: string, limit: number) {
    return this.prisma.authSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
        ipAddress: true,
        userAgent: true,
      },
    });
  }

  findRecentOrders(userId: string, limit: number) {
    return this.prisma.order.findMany({
      where: {
        OR: [
          { buyer: { userId } },
          { seller: { userId } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        orderStatus: true,
        totalAmount: true,
        createdAt: true,
      },
    });
  }

  findRecentAuditActions(userId: string, limit: number) {
    return this.prisma.auditLog.findMany({
      where: {
        OR: [
          { actorUserId: userId },
          {
            entityType: "USER",
            entityId: userId,
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
      },
    });
  }

  getUserStats() {
    const activeUserWhere: Prisma.UserWhereInput = { deletedAt: null };

    return Promise.all([
      this.prisma.user.count({ where: activeUserWhere }),
      this.prisma.user.count({
        where: { ...activeUserWhere, status: UserStatus.ACTIVE },
      }),
      this.prisma.user.count({
        where: { ...activeUserWhere, status: UserStatus.DISABLED },
      }),
      this.prisma.user.count({
        where: { ...activeUserWhere, role: UserRole.BUYER },
      }),
      this.prisma.user.count({
        where: { ...activeUserWhere, role: UserRole.SELLER },
      }),
      this.prisma.user.count({
        where: { ...activeUserWhere, role: UserRole.DELIVERY_PARTNER },
      }),
    ]);
  }
}
