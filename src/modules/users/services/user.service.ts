import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../../shared/errors/app.errors.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import { hashPassword, verifyPassword } from "../../../utils/password.util.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import { USER_ACTIONS, USER_AUDIT_ENTITY_TYPE } from "../constants/user.constants.js";
import {
  UserRepository,
  type UserProfileRecord,
} from "../repositories/user.repository.js";
import type {
  ChangePasswordInput,
  UpdateProfileInput,
  UserProfileDto,
} from "../types/user.types.js";

function toUserProfileDto(record: UserProfileRecord): UserProfileDto {
  return {
    id: record.id,
    email: record.email,
    role: record.role as UserRole,
    status: record.status as UserStatus,
    mustChangePassword: record.mustChangePassword,
    firstName: record.firstName,
    lastName: record.lastName,
    phoneNumber: record.phoneNumber,
    profileImage: record.profileImage,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    buyerProfile: record.buyerProfile,
    sellerProfile: record.sellerProfile,
    deliveryPartnerProfile: record.deliveryPartnerProfile,
  };
}

function buildProfileUpdateMetadata(
  before: UserProfileRecord,
  input: UpdateProfileInput,
): Record<string, unknown> {
  const changedFields: string[] = [];

  if (input.firstName !== undefined && input.firstName !== before.firstName) {
    changedFields.push("firstName");
  }
  if (input.lastName !== undefined && input.lastName !== before.lastName) {
    changedFields.push("lastName");
  }
  if (
    input.phoneNumber !== undefined &&
    input.phoneNumber !== before.phoneNumber
  ) {
    changedFields.push("phoneNumber");
  }
  if (
    input.profileImage !== undefined &&
    input.profileImage !== before.profileImage
  ) {
    changedFields.push("profileImage");
  }

  return { changedFields };
}

function assertUserCanModifyProfile(status: UserStatus): void {
  if (status !== UserStatus.ACTIVE) {
    throw new ForbiddenError("Account is disabled");
  }
}

export class UserService {
  private readonly repo = new UserRepository(prisma);

  async getCurrentProfile(userId: string): Promise<UserProfileDto> {
    const profile = await this.repo.findProfileById(userId);
    if (!profile) throw new NotFoundError("User not found");

    return toUserProfileDto(profile);
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<UserProfileDto> {
    const existing = await this.repo.findProfileById(userId);
    if (!existing) throw new NotFoundError("User not found");

    assertUserCanModifyProfile(existing.status as UserStatus);

    if (input.phoneNumber) {
      const phoneTaken = await this.repo.findByPhoneNumberExcludingUser(
        input.phoneNumber,
        userId,
      );
      if (phoneTaken) {
        throw new ConflictError("Phone number is already in use");
      }
    }

    const updated = await this.repo.updateProfile(userId, input);

    auditLogger.log({
      actorUserId: userId,
      action: USER_ACTIONS.UPDATE_PROFILE,
      entityType: USER_AUDIT_ENTITY_TYPE,
      entityId: userId,
      metadata: buildProfileUpdateMetadata(existing, input),
    });

    return toUserProfileDto(updated);
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<void> {
    const existing = await this.repo.findProfileById(userId);
    if (!existing) throw new NotFoundError("User not found");

    assertUserCanModifyProfile(existing.status as UserStatus);

    const user = await this.repo.findByIdWithPassword(userId);
    if (!user) throw new NotFoundError("User not found");

    const passwordValid = await verifyPassword(
      input.currentPassword,
      user.passwordHash,
    );
    if (!passwordValid) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    const newPasswordHash = await hashPassword(input.newPassword);

    await prisma.$transaction(async (tx) => {
      const repo = new UserRepository(tx);
      await repo.updatePassword(userId, newPasswordHash);
      await repo.revokeAllActiveSessions(userId);
    });

    auditLogger.log({
      actorUserId: userId,
      action: USER_ACTIONS.CHANGE_PASSWORD,
      entityType: USER_AUDIT_ENTITY_TYPE,
      entityId: userId,
      metadata: { sessionsRevoked: true },
    });
  }
}
