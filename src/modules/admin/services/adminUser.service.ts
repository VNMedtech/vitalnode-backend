import { Prisma } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { canTransitionSellerApproval } from "../../../shared/stateMachine/sellerApproval.guard.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import {
  ADMIN_USER_ACTIONS,
  ADMIN_USER_ACTIVITY_DEFAULT_LIMIT,
  ADMIN_USER_AUDIT_ENTITY_TYPE,
} from "../constants/adminUser.constants.js";
import {
  toAdminUserActivityDto,
  toAdminUserDetailDto,
  toAdminUserListItemDto,
  toAdminUserStatsDto,
} from "../dto/adminUser.dto.js";
import { AdminUserRepository } from "../repositories/adminUser.repository.js";
import type {
  AdminUserActivityDto,
  AdminUserDetailDto,
  AdminUserListItemDto,
  AdminUserStatsDto,
  DisableAdminUserInput,
  EnableAdminUserInput,
  ListAdminUsersQuery,
  UpdateAdminUserInput,
} from "../types/adminUser.types.js";

function isPrismaUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function assertNotSelf(actorUserId: string, targetUserId: string): void {
  if (actorUserId === targetUserId) {
    throw new ForbiddenError("Administrators cannot perform this action on their own account");
  }
}

function assertTargetIsNotAdmin(user: { role: string }): void {
  if (user.role === UserRole.ADMIN) {
    throw new ForbiddenError("Administrator accounts cannot be modified through user management");
  }
}

export class AdminUserService {
  private readonly repo = new AdminUserRepository(prisma);

  async listUsers(
    query: ListAdminUsersQuery,
  ): Promise<{
    items: AdminUserListItemDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const [records, total] = await Promise.all([
      this.repo.findUsers(query),
      this.repo.countUsers(query),
    ]);

    return {
      items: records.map(toAdminUserListItemDto),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getUserById(id: string): Promise<AdminUserDetailDto> {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const [addressesCount, ordersCount, lastLogin] = await Promise.all([
      this.repo.countAddressesForUser(id),
      this.repo.countOrdersForUser(id),
      this.repo.findLastLoginAt(id),
    ]);

    return toAdminUserDetailDto(
      user,
      { addressesCount, ordersCount },
      lastLogin?.createdAt ?? null,
    );
  }

  async updateUser(
    actorUserId: string,
    id: string,
    input: UpdateAdminUserInput,
  ): Promise<AdminUserDetailDto> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError("User not found");
    }

    assertNotSelf(actorUserId, id);
    assertTargetIsNotAdmin(existing);

    if (input.email && input.email !== existing.email) {
      const emailTaken = await this.repo.findByEmailExcludingUser(input.email, id);
      if (emailTaken) {
        throw new ConflictError("Email already registered");
      }
    }

    if (
      input.phoneNumber !== undefined &&
      input.phoneNumber !== existing.phoneNumber &&
      input.phoneNumber
    ) {
      const phoneTaken = await this.repo.findByPhoneExcludingUser(
        input.phoneNumber,
        id,
      );
      if (phoneTaken) {
        throw new ConflictError("Phone number is already in use");
      }
    }

    const changedFields: string[] = [];
    if (input.firstName !== undefined && input.firstName !== existing.firstName) {
      changedFields.push("firstName");
    }
    if (input.lastName !== undefined && input.lastName !== existing.lastName) {
      changedFields.push("lastName");
    }
    if (input.email !== undefined && input.email !== existing.email) {
      changedFields.push("email");
    }
    if (
      input.phoneNumber !== undefined &&
      input.phoneNumber !== existing.phoneNumber
    ) {
      changedFields.push("phoneNumber");
    }
    if (input.status !== undefined && input.status !== existing.status) {
      changedFields.push("status");
    }

    try {
      const updated = await this.repo.updateUser(id, input);

      if (input.status === UserStatus.DISABLED && existing.status !== UserStatus.DISABLED) {
        await this.repo.revokeAllActiveSessions(id);
        await this.syncSellerDisable(id, existing);
      }

      if (input.status === UserStatus.ACTIVE && existing.status !== UserStatus.ACTIVE) {
        await this.syncSellerEnable(id, existing);
      }

      auditLogger.log({
        actorUserId,
        action: ADMIN_USER_ACTIONS.UPDATE,
        entityType: ADMIN_USER_AUDIT_ENTITY_TYPE,
        entityId: id,
        metadata: {
          changedFields,
          email: updated.email,
          role: updated.role,
        },
      });

      return this.getUserById(id);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictError("Email or phone number is already in use");
      }
      throw error;
    }
  }

  async disableUser(
    actorUserId: string,
    id: string,
    input: DisableAdminUserInput = {},
  ): Promise<AdminUserDetailDto> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError("User not found");
    }

    assertNotSelf(actorUserId, id);
    assertTargetIsNotAdmin(existing);

    if (existing.status === UserStatus.DISABLED) {
      throw new ConflictError("User is already disabled");
    }

    await this.repo.updateUserStatus(id, UserStatus.DISABLED);
    await this.repo.revokeAllActiveSessions(id);
    await this.syncSellerDisable(id, existing);

    auditLogger.log({
      actorUserId,
      action: ADMIN_USER_ACTIONS.DISABLE,
      entityType: ADMIN_USER_AUDIT_ENTITY_TYPE,
      entityId: id,
      metadata: {
        previousStatus: existing.status,
        newStatus: UserStatus.DISABLED,
        email: existing.email,
        role: existing.role,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    return this.getUserById(id);
  }

  async enableUser(
    actorUserId: string,
    id: string,
    input: EnableAdminUserInput = {},
  ): Promise<AdminUserDetailDto> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError("User not found");
    }

    assertNotSelf(actorUserId, id);
    assertTargetIsNotAdmin(existing);

    if (existing.status === UserStatus.ACTIVE) {
      throw new ConflictError("User is already active");
    }

    await this.repo.updateUserStatus(id, UserStatus.ACTIVE);
    await this.syncSellerEnable(id, existing);

    auditLogger.log({
      actorUserId,
      action: ADMIN_USER_ACTIONS.ENABLE,
      entityType: ADMIN_USER_AUDIT_ENTITY_TYPE,
      entityId: id,
      metadata: {
        previousStatus: existing.status,
        newStatus: UserStatus.ACTIVE,
        email: existing.email,
        role: existing.role,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    return this.getUserById(id);
  }

  async softDeleteUser(actorUserId: string, id: string): Promise<AdminUserDetailDto> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError("User not found");
    }

    assertNotSelf(actorUserId, id);
    assertTargetIsNotAdmin(existing);

    await this.repo.softDeleteUser(id);
    await this.repo.revokeAllActiveSessions(id);
    await this.syncSellerDisable(id, existing);

    auditLogger.log({
      actorUserId,
      action: ADMIN_USER_ACTIONS.DELETE,
      entityType: ADMIN_USER_AUDIT_ENTITY_TYPE,
      entityId: id,
      metadata: {
        email: existing.email,
        role: existing.role,
        softDelete: true,
      },
    });

    const deleted = await this.repo.findByIdIncludingDeleted(id);
    if (!deleted) {
      throw new NotFoundError("User not found");
    }

    const [addressesCount, ordersCount, lastLogin] = await Promise.all([
      this.repo.countAddressesForUser(id),
      this.repo.countOrdersForUser(id),
      this.repo.findLastLoginAt(id),
    ]);

    return toAdminUserDetailDto(
      deleted,
      { addressesCount, ordersCount },
      lastLogin?.createdAt ?? null,
    );
  }

  async getUserStats(): Promise<AdminUserStatsDto> {
    const [
      totalUsers,
      activeUsers,
      disabledUsers,
      buyersCount,
      sellersCount,
      deliveryPartnersCount,
    ] = await this.repo.getUserStats();

    return toAdminUserStatsDto({
      totalUsers,
      activeUsers,
      disabledUsers,
      buyersCount,
      sellersCount,
      deliveryPartnersCount,
    });
  }

  async getUserActivity(
    id: string,
    limit = ADMIN_USER_ACTIVITY_DEFAULT_LIMIT,
  ): Promise<AdminUserActivityDto> {
    const user = await this.repo.findByIdIncludingDeleted(id);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const [sessions, orders, actions] = await Promise.all([
      this.repo.findRecentSessions(id, limit),
      this.repo.findRecentOrders(id, limit),
      this.repo.findRecentAuditActions(id, limit),
    ]);

    return toAdminUserActivityDto({
      sessions,
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.orderStatus,
        totalAmount: order.totalAmount.toString(),
        createdAt: order.createdAt,
      })),
      actions: actions.map((action) => ({
        id: action.id,
        action: action.action,
        entityType: action.entityType,
        entityId: action.entityId,
        metadata: action.metadata,
        createdAt: action.createdAt,
      })),
    });
  }

  private async syncSellerDisable(
    userId: string,
    user: { role: string; sellerProfile: { approvalStatus: string } | null },
  ): Promise<void> {
    if (user.role !== UserRole.SELLER || !user.sellerProfile) {
      return;
    }

    const currentStatus = user.sellerProfile.approvalStatus as SellerApprovalStatus;
    if (
      currentStatus === SellerApprovalStatus.ACTIVE &&
      canTransitionSellerApproval(currentStatus, SellerApprovalStatus.DISABLED)
    ) {
      await this.repo.updateSellerApprovalStatus(
        userId,
        SellerApprovalStatus.DISABLED,
      );
    }
  }

  private async syncSellerEnable(
    userId: string,
    user: { role: string; sellerProfile: { approvalStatus: string } | null },
  ): Promise<void> {
    if (user.role !== UserRole.SELLER || !user.sellerProfile) {
      return;
    }

    const currentStatus = user.sellerProfile.approvalStatus as SellerApprovalStatus;
    if (
      currentStatus === SellerApprovalStatus.DISABLED &&
      canTransitionSellerApproval(currentStatus, SellerApprovalStatus.ACTIVE)
    ) {
      await this.repo.updateSellerApprovalStatus(
        userId,
        SellerApprovalStatus.ACTIVE,
      );
    }
  }
}
