import type {
  BuyerType,
  SellerApprovalStatus,
  UserRole,
  UserStatus,
  Prisma,
  PrismaClient,
} from "../../../../generated/prisma/client.js";

export class AuthRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  findUserByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: {
        id: true,
        email: true,
        passwordHash: true,
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
  }

  findUserById(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
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
  }

  createBuyerUser(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    userStatus: UserStatus;
    role: UserRole;
    buyerType: BuyerType;
  }) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
        status: input.userStatus,
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber,
        buyerProfile: {
          create: {
            buyerType: input.buyerType,
          },
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        sellerProfile: {
          select: {
            approvalStatus: true,
          },
        },
      },
    });
  }

  createSellerUser(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    userStatus: UserStatus;
    role: UserRole;
    seller: {
      businessName: string;
      contactPerson: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
      latitude?: string;
      longitude?: string;
      approvalStatus: SellerApprovalStatus;
    };
  }) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
        status: input.userStatus,
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber,
        sellerProfile: {
          create: {
            ...input.seller,
          },
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        sellerProfile: {
          select: {
            approvalStatus: true,
          },
        },
      },
    });
  }

  createAuthSession(input: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.authSession.create({
      data: {
        id: input.id,
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });
  }

  findSessionById(sessionId: string) {
    return this.prisma.authSession.findFirst({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        refreshTokenHash: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
  }

  revokeSession(sessionId: string, revokedAt = new Date()) {
    return this.prisma.authSession.update({
      where: { id: sessionId },
      data: { revokedAt },
      select: { id: true, revokedAt: true },
    });
  }

  createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.prisma.passwordResetToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
      select: { id: true, userId: true, expiresAt: true },
    });
  }

  findPasswordResetTokenByHash(tokenHash: string) {
    return this.prisma.passwordResetToken.findFirst({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
  }

  markPasswordResetTokenUsed(id: string, usedAt = new Date()) {
    return this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt },
      select: { id: true, usedAt: true },
    });
  }

  updateUserPassword(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
      select: { id: true },
    });
  }
}
