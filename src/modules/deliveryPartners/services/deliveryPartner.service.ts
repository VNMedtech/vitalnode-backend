import { Prisma } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import { emailClient } from "../../../infrastructure/email/index.js";
import {
  ConflictError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import {
  generateTemporaryPassword,
  hashPassword,
} from "../../../utils/password.util.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import { AuthRepository } from "../../auth/repositories/auth.repository.js";
import {
  DELIVERY_PARTNER_ACTIONS,
  DELIVERY_PARTNER_AUDIT_ENTITY_TYPE,
  DELIVERY_PARTNER_NOTIFICATION_TYPES,
} from "../constants/deliveryPartner.constants.js";
import { toDeliveryPartnerDetailDto } from "../dto/deliveryPartner.dto.js";
import { toDeliveryPartnerListItemDtoFromRecord } from "../dto/deliveryPartner.dto.js";
import { DeliveryPartnerRepository } from "../repositories/deliveryPartner.repository.js";
import type {
  CreateDeliveryPartnerInput,
  CreateDeliveryPartnerResultDto,
  DeliveryPartnerDetailDto,
  DeliveryPartnerListItemDto,
  DisableDeliveryPartnerInput,
  EnableDeliveryPartnerInput,
  ListDeliveryPartnersQuery,
  UpdateDeliveryPartnerInput,
} from "../types/deliveryPartner.types.js";

function isPrismaUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function buildUpdateMetadata(
  before: {
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  },
  input: UpdateDeliveryPartnerInput,
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
    input.addressLine1 !== undefined &&
    input.addressLine1 !== before.addressLine1
  ) {
    changedFields.push("addressLine1");
  }
  if (
    input.addressLine2 !== undefined &&
    input.addressLine2 !== before.addressLine2
  ) {
    changedFields.push("addressLine2");
  }
  if (input.city !== undefined && input.city !== before.city) {
    changedFields.push("city");
  }
  if (input.state !== undefined && input.state !== before.state) {
    changedFields.push("state");
  }
  if (input.country !== undefined && input.country !== before.country) {
    changedFields.push("country");
  }
  if (
    input.postalCode !== undefined &&
    input.postalCode !== before.postalCode
  ) {
    changedFields.push("postalCode");
  }

  return { changedFields };
}

export class DeliveryPartnerService {
  private readonly repo = new DeliveryPartnerRepository(prisma);

  async createDeliveryPartner(
    actorUserId: string,
    input: CreateDeliveryPartnerInput,
  ): Promise<CreateDeliveryPartnerResultDto> {
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

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    try {
      const created = await this.repo.createDeliveryPartner({
        ...input,
        passwordHash,
      });

      const profile = created.deliveryPartnerProfile;
      if (!profile) {
        throw new ConflictError("Failed to create delivery partner profile");
      }

      auditLogger.log({
        actorUserId,
        action: DELIVERY_PARTNER_ACTIONS.CREATE,
        entityType: DELIVERY_PARTNER_AUDIT_ENTITY_TYPE,
        entityId: profile.id,
        metadata: {
          userId: profile.userId,
          email: profile.user.email,
          city: profile.city,
        },
      });

      void this.repo
        .createNotification({
          userId: profile.userId,
          type: DELIVERY_PARTNER_NOTIFICATION_TYPES.CREATED,
          title: "Delivery partner account created",
          message:
            "Your delivery partner account has been created. Sign in with your temporary password and change it immediately.",
        })
        .catch(() => undefined);

      void emailClient
        .send({
          to: profile.user.email,
          subject: "Your delivery partner account",
          html: `<p>Your delivery partner account has been created.</p><p>Email: <b>${profile.user.email}</b></p><p>Temporary password: <b>${temporaryPassword}</b></p><p>You must change your password on first login.</p>`,
          text: `Your delivery partner account has been created. Email: ${profile.user.email}. Temporary password: ${temporaryPassword}. You must change your password on first login.`,
        })
        .catch(() => undefined);

      return {
        deliveryPartner: toDeliveryPartnerDetailDto(profile),
        temporaryPassword,
      };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictError("Email or phone number already registered");
      }
      throw error;
    }
  }

  async updateDeliveryPartner(
    actorUserId: string,
    id: string,
    input: UpdateDeliveryPartnerInput,
  ): Promise<DeliveryPartnerDetailDto> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError("Delivery partner not found");
    }

    if (input.phoneNumber) {
      const phoneTaken = await this.repo.findUserByPhoneExcludingUser(
        input.phoneNumber,
        existing.userId,
      );
      if (phoneTaken) {
        throw new ConflictError("Phone number is already in use");
      }
    }

    const userUpdate =
      input.firstName !== undefined ||
      input.lastName !== undefined ||
      input.phoneNumber !== undefined
        ? {
            ...(input.firstName !== undefined
              ? { firstName: input.firstName }
              : {}),
            ...(input.lastName !== undefined
              ? { lastName: input.lastName }
              : {}),
            ...(input.phoneNumber !== undefined
              ? { phoneNumber: input.phoneNumber }
              : {}),
          }
        : undefined;

    const profileUpdate =
      input.addressLine1 !== undefined ||
      input.addressLine2 !== undefined ||
      input.city !== undefined ||
      input.state !== undefined ||
      input.country !== undefined ||
      input.postalCode !== undefined
        ? {
            ...(input.addressLine1 !== undefined
              ? { addressLine1: input.addressLine1 }
              : {}),
            ...(input.addressLine2 !== undefined
              ? { addressLine2: input.addressLine2 }
              : {}),
            ...(input.city !== undefined ? { city: input.city } : {}),
            ...(input.state !== undefined ? { state: input.state } : {}),
            ...(input.country !== undefined ? { country: input.country } : {}),
            ...(input.postalCode !== undefined
              ? { postalCode: input.postalCode }
              : {}),
          }
        : undefined;

    try {
      const updated = await this.repo.updateDeliveryPartner(id, existing.userId, {
        ...(userUpdate ? { user: userUpdate } : {}),
        ...(profileUpdate ? { profile: profileUpdate } : {}),
      });

      auditLogger.log({
        actorUserId,
        action: DELIVERY_PARTNER_ACTIONS.UPDATE,
        entityType: DELIVERY_PARTNER_AUDIT_ENTITY_TYPE,
        entityId: id,
        metadata: buildUpdateMetadata(
          {
            firstName: existing.user.firstName,
            lastName: existing.user.lastName,
            phoneNumber: existing.user.phoneNumber,
            addressLine1: existing.addressLine1,
            addressLine2: existing.addressLine2,
            city: existing.city,
            state: existing.state,
            country: existing.country,
            postalCode: existing.postalCode,
          },
          input,
        ),
      });

      return toDeliveryPartnerDetailDto(updated);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictError("Phone number is already in use");
      }
      throw error;
    }
  }

  async disableDeliveryPartner(
    actorUserId: string,
    id: string,
    input: DisableDeliveryPartnerInput = {},
  ): Promise<DeliveryPartnerDetailDto> {
    const partner = await this.repo.findById(id);
    if (!partner) {
      throw new NotFoundError("Delivery partner not found");
    }

    const currentStatus = partner.user.status as UserStatus;
    if (currentStatus === UserStatus.DISABLED) {
      throw new ConflictError("Delivery partner is already disabled");
    }

    await this.repo.updateUserStatus(partner.userId, UserStatus.DISABLED);
    await new AuthRepository(prisma).revokeAllActiveSessions(partner.userId);

    const updated = await this.repo.findById(id);
    if (!updated) {
      throw new NotFoundError("Delivery partner not found");
    }

    auditLogger.log({
      actorUserId,
      action: DELIVERY_PARTNER_ACTIONS.DISABLE,
      entityType: DELIVERY_PARTNER_AUDIT_ENTITY_TYPE,
      entityId: id,
      metadata: {
        userId: partner.userId,
        previousStatus: currentStatus,
        newStatus: UserStatus.DISABLED,
        email: partner.user.email,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    void this.repo
      .createNotification({
        userId: partner.userId,
        type: DELIVERY_PARTNER_NOTIFICATION_TYPES.DISABLED,
        title: "Delivery partner account disabled",
        message: input.reason
          ? `Your delivery partner account has been disabled. Reason: ${input.reason}`
          : "Your delivery partner account has been disabled.",
      })
      .catch(() => undefined);

    return toDeliveryPartnerDetailDto(updated);
  }

  async enableDeliveryPartner(
    actorUserId: string,
    id: string,
    input: EnableDeliveryPartnerInput = {},
  ): Promise<DeliveryPartnerDetailDto> {
    const partner = await this.repo.findById(id);
    if (!partner) {
      throw new NotFoundError("Delivery partner not found");
    }

    const currentStatus = partner.user.status as UserStatus;
    if (currentStatus === UserStatus.ACTIVE) {
      throw new ConflictError("Delivery partner is already active");
    }

    await this.repo.updateUserStatus(partner.userId, UserStatus.ACTIVE);

    const updated = await this.repo.findById(id);
    if (!updated) {
      throw new NotFoundError("Delivery partner not found");
    }

    auditLogger.log({
      actorUserId,
      action: DELIVERY_PARTNER_ACTIONS.ENABLE,
      entityType: DELIVERY_PARTNER_AUDIT_ENTITY_TYPE,
      entityId: id,
      metadata: {
        userId: partner.userId,
        previousStatus: currentStatus,
        newStatus: UserStatus.ACTIVE,
        email: partner.user.email,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    void this.repo
      .createNotification({
        userId: partner.userId,
        type: DELIVERY_PARTNER_NOTIFICATION_TYPES.ENABLED,
        title: "Delivery partner account re-enabled",
        message: input.reason
          ? `Your delivery partner account has been re-enabled. Reason: ${input.reason}`
          : "Your delivery partner account has been re-enabled.",
      })
      .catch(() => undefined);

    return toDeliveryPartnerDetailDto(updated);
  }

  async listDeliveryPartners(query: ListDeliveryPartnersQuery): Promise<{
    items: DeliveryPartnerListItemDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const [records, total] = await Promise.all([
      this.repo.findManyPaginated(query),
      this.repo.count({
        search: query.search,
        status: query.status,
        city: query.city,
        state: query.state,
        country: query.country,
      }),
    ]);

    return {
      items: records.map(toDeliveryPartnerListItemDtoFromRecord),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getDeliveryPartnerById(id: string): Promise<DeliveryPartnerDetailDto> {
    const partner = await this.repo.findById(id);
    if (!partner) {
      throw new NotFoundError("Delivery partner not found");
    }

    return toDeliveryPartnerDetailDto(partner);
  }
}
