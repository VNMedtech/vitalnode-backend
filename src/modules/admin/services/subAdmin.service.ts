import { Prisma } from "../../../../generated/prisma/client.js";
import { emailClient } from "../../../infrastructure/email/index.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { hashPassword } from "../../../utils/password.util.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import {
  SUB_ADMIN_ACTIONS,
  SUB_ADMIN_AUDIT_ENTITY_TYPE,
  SUB_ADMIN_NOTIFICATION_TYPES,
} from "../constants/subAdmin.constants.js";
import { toSubAdminDetailDto, toSubAdminListItemDto } from "../dto/subAdmin.dto.js";
import { SubAdminRepository } from "../repositories/subAdmin.repository.js";
import type {
  AdminModuleCatalogItemDto,
  CreateSubAdminInput,
  DisableEnableSubAdminInput,
  ListSubAdminsQuery,
  SubAdminDetailDto,
  SubAdminListItemDto,
  UpdateSubAdminInput,
} from "../types/subAdmin.types.js";
import { ADMIN_MODULE_CATALOG } from "../../../shared/enums/adminModule.enum.js";

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

export class SubAdminService {
  private readonly repo = new SubAdminRepository(prisma);

  listModules(): AdminModuleCatalogItemDto[] {
    return ADMIN_MODULE_CATALOG.map((item) => ({ ...item }));
  }

  async listSubAdmins(
    query: ListSubAdminsQuery,
  ): Promise<{
    items: SubAdminListItemDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const [records, total] = await Promise.all([
      this.repo.findMany(query),
      this.repo.count(query),
    ]);

    return {
      items: records.map(toSubAdminListItemDto),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getSubAdminById(id: string): Promise<SubAdminDetailDto> {
    const record = await this.repo.findById(id);
    if (!record) {
      throw new NotFoundError("Sub-admin not found");
    }
    const lastLogin = await this.repo.findLastLoginAt(id);
    return toSubAdminDetailDto(record, lastLogin?.createdAt ?? null);
  }

  async createSubAdmin(
    actorUserId: string,
    input: CreateSubAdminInput,
  ): Promise<SubAdminDetailDto> {
    const existingEmail = await this.repo.findUserByEmail(input.email);
    if (existingEmail) {
      throw new ConflictError("Email already registered");
    }

    if (input.phoneNumber) {
      const phoneTaken = await this.repo.findUserByPhone(input.phoneNumber);
      if (phoneTaken) {
        throw new ConflictError("Phone number is already in use");
      }
    }

    const passwordHash = await hashPassword(input.password);

    try {
      const created = await this.repo.createSubAdmin({
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber,
        modules: input.modules,
      });

      auditLogger.log({
        actorUserId,
        action: SUB_ADMIN_ACTIONS.CREATE,
        entityType: SUB_ADMIN_AUDIT_ENTITY_TYPE,
        entityId: created.id,
        metadata: {
          email: created.email,
          modules: input.modules,
        },
      });

      void this.repo
        .createNotification({
          userId: created.id,
          type: SUB_ADMIN_NOTIFICATION_TYPES.CREATED,
          title: "Sub-admin account created",
          message:
            "Your sub-admin account has been created. Sign in with the email and password provided by your administrator.",
        })
        .catch(() => undefined);

      void emailClient
        .send({
          to: created.email,
          subject: "Your VitalNode sub-admin account",
          html: `<p>Your sub-admin account has been created.</p><p>Email: <b>${created.email}</b></p><p>Sign in with the password shared by your administrator.</p>`,
          text: `Your sub-admin account has been created. Email: ${created.email}. Sign in with the password shared by your administrator.`,
        })
        .catch(() => undefined);

      return toSubAdminDetailDto(created, null);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictError("Email or phone number already registered");
      }
      throw error;
    }
  }

  async updateSubAdmin(
    actorUserId: string,
    id: string,
    input: UpdateSubAdminInput,
  ): Promise<SubAdminDetailDto> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError("Sub-admin not found");
    }

    assertNotSelf(actorUserId, id);

    if (input.phoneNumber) {
      const phoneTaken = await this.repo.findUserByPhone(input.phoneNumber);
      if (phoneTaken && phoneTaken.id !== id) {
        throw new ConflictError("Phone number is already in use");
      }
    }

    try {
      const updated = await this.repo.updateSubAdmin(id, input);

      auditLogger.log({
        actorUserId,
        action: SUB_ADMIN_ACTIONS.UPDATE,
        entityType: SUB_ADMIN_AUDIT_ENTITY_TYPE,
        entityId: id,
        metadata: {
          email: updated.email,
          ...(input.modules ? { modules: input.modules } : {}),
        },
      });

      const lastLogin = await this.repo.findLastLoginAt(id);
      return toSubAdminDetailDto(updated, lastLogin?.createdAt ?? null);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictError("Phone number is already in use");
      }
      throw error;
    }
  }

  async disableSubAdmin(
    actorUserId: string,
    id: string,
    input: DisableEnableSubAdminInput = {},
  ): Promise<SubAdminDetailDto> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError("Sub-admin not found");
    }

    assertNotSelf(actorUserId, id);

    if (existing.status === UserStatus.DISABLED) {
      throw new ConflictError("Sub-admin is already disabled");
    }

    const updated = await this.repo.updateStatus(id, UserStatus.DISABLED);
    await this.repo.revokeAllActiveSessions(id);

    auditLogger.log({
      actorUserId,
      action: SUB_ADMIN_ACTIONS.DISABLE,
      entityType: SUB_ADMIN_AUDIT_ENTITY_TYPE,
      entityId: id,
      metadata: {
        email: existing.email,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    const lastLogin = await this.repo.findLastLoginAt(id);
    return toSubAdminDetailDto(updated, lastLogin?.createdAt ?? null);
  }

  async enableSubAdmin(
    actorUserId: string,
    id: string,
    input: DisableEnableSubAdminInput = {},
  ): Promise<SubAdminDetailDto> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError("Sub-admin not found");
    }

    assertNotSelf(actorUserId, id);

    if (existing.status === UserStatus.ACTIVE) {
      throw new ConflictError("Sub-admin is already active");
    }

    const updated = await this.repo.updateStatus(id, UserStatus.ACTIVE);

    auditLogger.log({
      actorUserId,
      action: SUB_ADMIN_ACTIONS.ENABLE,
      entityType: SUB_ADMIN_AUDIT_ENTITY_TYPE,
      entityId: id,
      metadata: {
        email: existing.email,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    const lastLogin = await this.repo.findLastLoginAt(id);
    return toSubAdminDetailDto(updated, lastLogin?.createdAt ?? null);
  }

  async deleteSubAdmin(actorUserId: string, id: string): Promise<SubAdminDetailDto> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError("Sub-admin not found");
    }

    assertNotSelf(actorUserId, id);

    const deleted = await this.repo.softDelete(id);
    await this.repo.revokeAllActiveSessions(id);

    auditLogger.log({
      actorUserId,
      action: SUB_ADMIN_ACTIONS.DELETE,
      entityType: SUB_ADMIN_AUDIT_ENTITY_TYPE,
      entityId: id,
      metadata: {
        email: existing.email,
        softDelete: true,
      },
    });

    const lastLogin = await this.repo.findLastLoginAt(id);
    return toSubAdminDetailDto(deleted, lastLogin?.createdAt ?? null);
  }
}

export const subAdminService = new SubAdminService();
