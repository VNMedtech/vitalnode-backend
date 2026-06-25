import { env } from "../../../config/env.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../../shared/errors/app.errors.js";
import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../../utils/jwt.util.js";
import { hashPassword, verifyPassword } from "../../../utils/password.util.js";
import { randomToken, sha256 } from "../../../utils/crypto.util.js";
import { randomUUID } from "node:crypto";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import {
  buildAppUrl,
  emailService,
} from "../../email/services/email.service.js";
import { AUTH_ACTIONS, AUTH_AUDIT_ENTITY_TYPE } from "../constants/auth.constants.js";
import { AuthRepository } from "../repositories/auth.repository.js";
import type {
  AuthenticatedUserDto,
  LoginResultDto,
  TokenPair,
} from "../types/auth.types.js";

type AuthUserRecord = {
  id: string;
  email: string;
  role: string;
  status: string;
  mustChangePassword?: boolean;
  sellerProfile?: { approvalStatus: string } | null;
};

function resolveSellerApprovalStatus(
  role: UserRole,
  sellerProfile?: { approvalStatus: string } | null,
): SellerApprovalStatus | undefined {
  if (role !== UserRole.SELLER) {
    return undefined;
  }
  if (!sellerProfile) {
    throw new ForbiddenError("Seller profile not found");
  }
  return sellerProfile.approvalStatus as SellerApprovalStatus;
}

function assertAccountCanAuthenticate(user: AuthUserRecord): void {
  if ((user.status as UserStatus) !== UserStatus.ACTIVE) {
    throw new ForbiddenError("Account is disabled");
  }

  const role = user.role as UserRole;
  if (role === UserRole.SELLER) {
    const approvalStatus = resolveSellerApprovalStatus(role, user.sellerProfile);
    if (approvalStatus === SellerApprovalStatus.DISABLED) {
      throw new ForbiddenError("Account is disabled");
    }
  }
}

function toAuthenticatedUserDto(user: AuthUserRecord): AuthenticatedUserDto {
  const role = user.role as UserRole;
  return {
    id: user.id,
    email: user.email,
    role,
    sellerApprovalStatus: resolveSellerApprovalStatus(role, user.sellerProfile),
    ...(user.mustChangePassword ? { mustChangePassword: true } : {}),
  };
}

function buildResetPasswordLink(token: string): string {
  if (!env.webAppBaseUrl) return "";
  const url = new URL("/reset-password", env.webAppBaseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export class AuthService {
  private readonly repo = new AuthRepository(prisma);

  async registerBuyer(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    buyerType: "DOCTOR" | "HOSPITAL";
    ipAddress?: string;
    userAgent?: string;
  }): Promise<LoginResultDto> {
    const existing = await this.repo.findUserByEmail(input.email);
    if (existing) throw new ConflictError("Email already registered");

    const passwordHash = await hashPassword(input.password);

    const created = await this.repo.createBuyerUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phoneNumber: input.phoneNumber,
      userStatus: UserStatus.ACTIVE,
      role: UserRole.BUYER,
      buyerType: input.buyerType,
    });

    const userDto = toAuthenticatedUserDto(created);
    const tokens = await this.issueTokenPair(userDto, {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    auditLogger.log({
      actorUserId: created.id,
      action: AUTH_ACTIONS.REGISTER_BUYER,
      entityType: AUTH_AUDIT_ENTITY_TYPE,
      entityId: created.id,
      metadata: { email: created.email },
    });

    return {
      user: userDto,
      ...tokens,
    };
  }

  async registerSeller(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    businessName: string;
    contactPerson: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    latitude?: number;
    longitude?: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<LoginResultDto> {
    const existing = await this.repo.findUserByEmail(input.email);
    if (existing) throw new ConflictError("Email already registered");

    const passwordHash = await hashPassword(input.password);

    const created = await this.repo.createSellerUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phoneNumber: input.phoneNumber,
      userStatus: UserStatus.ACTIVE,
      role: UserRole.SELLER,
      seller: {
        businessName: input.businessName,
        contactPerson: input.contactPerson,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        country: input.country,
        postalCode: input.postalCode,
        latitude: input.latitude?.toString(),
        longitude: input.longitude?.toString(),
        approvalStatus: SellerApprovalStatus.PENDING_APPROVAL,
      },
    });

    const userDto = toAuthenticatedUserDto(created);
    const tokens = await this.issueTokenPair(userDto, {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    auditLogger.log({
      actorUserId: created.id,
      action: AUTH_ACTIONS.REGISTER_SELLER,
      entityType: AUTH_AUDIT_ENTITY_TYPE,
      entityId: created.id,
      metadata: {
        email: created.email,
        approvalStatus: userDto.sellerApprovalStatus,
      },
    });

    return {
      user: userDto,
      ...tokens,
    };
  }

  async login(input: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<LoginResultDto> {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user) throw new UnauthorizedError("Invalid credentials");

    assertAccountCanAuthenticate(user);

    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedError("Invalid credentials");

    const userDto = toAuthenticatedUserDto(user);
    const tokens = await this.issueTokenPair(userDto, {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    auditLogger.log({
      actorUserId: user.id,
      action: AUTH_ACTIONS.LOGIN,
      entityType: AUTH_AUDIT_ENTITY_TYPE,
      entityId: user.id,
      metadata: {
        email: user.email,
        sellerApprovalStatus: userDto.sellerApprovalStatus,
      },
    });

    return {
      user: userDto,
      ...tokens,
    };
  }

  async refreshToken(input: {
    refreshToken: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<TokenPair> {
    const payload = verifyRefreshToken(input.refreshToken);

    const session = await this.repo.findSessionById(payload.tokenId);
    if (!session) throw new UnauthorizedError("Invalid refresh token");
    if (session.revokedAt) throw new UnauthorizedError("Refresh token revoked");
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError("Refresh token expired");
    }

    const presentedHash = sha256(input.refreshToken);
    if (presentedHash !== session.refreshTokenHash) {
      // Replay / stolen token protection: revoke the session immediately
      await this.repo.revokeSession(session.id);
      throw new UnauthorizedError("Invalid refresh token");
    }

    const user = await this.repo.findUserById(session.userId);
    if (!user) throw new UnauthorizedError("User not found");
    assertAccountCanAuthenticate(user);

    // Rotate refresh token: revoke old session, issue new session
    await this.repo.revokeSession(session.id);

    const userDto = toAuthenticatedUserDto(user);
    const tokens = await this.issueTokenPair(userDto, {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    auditLogger.log({
      actorUserId: user.id,
      action: AUTH_ACTIONS.REFRESH,
      entityType: AUTH_AUDIT_ENTITY_TYPE,
      entityId: user.id,
      metadata: { rotatedFromSessionId: session.id },
    });

    return tokens;
  }

  async logout(input: { refreshToken: string }): Promise<void> {
    const payload = verifyRefreshToken(input.refreshToken);
    const session = await this.repo.findSessionById(payload.tokenId);

    if (session && !session.revokedAt) {
      await this.repo.revokeSession(session.id);
      auditLogger.log({
        actorUserId: session.userId,
        action: AUTH_ACTIONS.LOGOUT,
        entityType: AUTH_AUDIT_ENTITY_TYPE,
        entityId: session.userId,
        metadata: { sessionId: session.id },
      });
    }
  }

  async forgotPassword(input: { email: string }): Promise<void> {
    const user = await this.repo.findUserByEmail(input.email);

    // Do not leak whether the email exists.
    if (!user) {
      return;
    }

    const rawToken = randomToken(32);
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(
      Date.now() + env.passwordResetTokenExpiresInMinutes * 60_000,
    );

    await this.repo.createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const resetLink = buildResetPasswordLink(rawToken);

    await emailService.sendPasswordResetEmail(user.email, {
      resetLink: resetLink || undefined,
      resetToken: resetLink ? undefined : rawToken,
      expiresInMinutes: env.passwordResetTokenExpiresInMinutes,
    });

    auditLogger.log({
      actorUserId: user.id,
      action: AUTH_ACTIONS.FORGOT_PASSWORD,
      entityType: AUTH_AUDIT_ENTITY_TYPE,
      entityId: user.id,
      metadata: { resetLinkGenerated: Boolean(resetLink) },
    });
  }

  async resetPassword(input: { token: string; newPassword: string }): Promise<void> {
    const tokenHash = sha256(input.token);
    const tokenRow = await this.repo.findPasswordResetTokenByHash(tokenHash);
    if (!tokenRow) throw new NotFoundError("Reset token not found");
    if (tokenRow.usedAt) throw new ConflictError("Reset token already used");
    if (tokenRow.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError("Reset token expired");
    }

    const newHash = await hashPassword(input.newPassword);

    await prisma.$transaction(async (tx) => {
      const repo = new AuthRepository(tx);
      await repo.updateUserPassword(tokenRow.userId, newHash);
      await repo.markPasswordResetTokenUsed(tokenRow.id);

      // Invalidate all sessions for security.
      await tx.authSession.updateMany({
        where: { userId: tokenRow.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    auditLogger.log({
      actorUserId: tokenRow.userId,
      action: AUTH_ACTIONS.RESET_PASSWORD,
      entityType: AUTH_AUDIT_ENTITY_TYPE,
      entityId: tokenRow.userId,
      metadata: {},
    });
  }

  private async issueTokenPair(
    user: AuthenticatedUserDto,
    sessionMeta: { ipAddress?: string; userAgent?: string },
  ): Promise<TokenPair> {
    // Pre-generate session id so JWT tokenId matches persisted AuthSession.id.
    const sessionId = randomUUID();

    const refreshToken = signRefreshToken({
      sub: user.id,
      tokenId: sessionId,
    });

    const refreshTokenHash = sha256(refreshToken);

    const expiresAt = new Date(Date.now() + this.refreshTtlMsFromEnv());

    await this.repo.createAuthSession({
      id: sessionId,
      userId: user.id,
      refreshTokenHash,
      expiresAt,
      ipAddress: sessionMeta.ipAddress,
      userAgent: sessionMeta.userAgent,
    });

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      sellerApprovalStatus: user.sellerApprovalStatus,
    });

    return { accessToken, refreshToken };
  }

  private refreshTtlMsFromEnv(): number {
    // env.jwtRefreshExpiresIn is a string like "7d" — we cannot parse it safely without
    // extra deps; keep the DB expiry authoritative via a conservative default.
    // If you want strict alignment, set PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES and
    // rotate refresh tokens frequently.
    //
    // For now, interpret common suffixes.
    const raw = env.jwtRefreshExpiresIn.trim();
    const match = /^(\d+)\s*([smhd])$/.exec(raw);
    if (!match) return 7 * 24 * 60 * 60_000;
    const n = Number(match[1]);
    const unit = match[2];
    const mult =
      unit === "s"
        ? 1000
        : unit === "m"
          ? 60_000
          : unit === "h"
            ? 60 * 60_000
            : 24 * 60 * 60_000;
    return n * mult;
  }
}
