import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";

const userProfileSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  mustChangePassword: true,
  firstName: true,
  lastName: true,
  phoneNumber: true,
  profileImage: true,
  createdAt: true,
  updatedAt: true,
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

export type UserProfileRecord = Prisma.UserGetPayload<{
  select: typeof userProfileSelect;
}>;

export class UserRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  findProfileById(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: userProfileSelect,
    });
  }

  findByIdWithPassword(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        passwordHash: true,
      },
    });
  }

  findByPhoneNumberExcludingUser(phoneNumber: string, excludeUserId: string) {
    return this.prisma.user.findFirst({
      where: {
        phoneNumber,
        deletedAt: null,
        id: { not: excludeUserId },
      },
      select: { id: true },
    });
  }

  updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string | null;
      profileImage?: string | null;
    },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: userProfileSelect,
    });
  }

  updatePassword(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
      select: { id: true },
    });
  }

  revokeAllActiveSessions(userId: string, revokedAt = new Date()) {
    return this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
  }
}
