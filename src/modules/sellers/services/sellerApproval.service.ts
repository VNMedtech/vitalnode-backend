import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import { canTransitionSellerApproval } from "../../../shared/stateMachine/sellerApproval.guard.js";
import {
  SELLER_ACTIONS,
  SELLER_AUDIT_ENTITY_TYPE,
  SELLER_NOTIFICATION_TYPES,
} from "../constants/seller.constants.js";
import {
  buildAppUrl,
  buildRecipientName,
} from "../../email/services/email.service.js";
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_TYPES,
  notificationDispatcher,
} from "../../notifications/index.js";
import { toSellerDetailDto } from "../dto/seller.dto.js";
import { SellerRepository } from "../repositories/seller.repository.js";
import type {
  DisableSellerInput,
  EnableSellerInput,
  RejectSellerInput,
  SellerDetailDto,
} from "../types/seller.types.js";

function assertTransitionAllowed(
  currentStatus: SellerApprovalStatus,
  targetStatus: SellerApprovalStatus,
): void {
  if (!canTransitionSellerApproval(currentStatus, targetStatus)) {
    throw new ConflictError(
      `Cannot transition seller from ${currentStatus} to ${targetStatus}`,
    );
  }
}

function assertCurrentStatus(
  currentStatus: SellerApprovalStatus,
  expectedStatus: SellerApprovalStatus,
  action: string,
): void {
  if (currentStatus !== expectedStatus) {
    throw new ConflictError(
      `Cannot ${action} seller while status is ${currentStatus}`,
    );
  }
}

export class SellerApprovalService {
  private readonly repo = new SellerRepository(prisma);

  async approveSeller(
    actorUserId: string,
    sellerId: string,
  ): Promise<SellerDetailDto> {
    const seller = await this.repo.findById(sellerId);
    if (!seller) {
      throw new NotFoundError("Seller not found");
    }

    const currentStatus = seller.approvalStatus as SellerApprovalStatus;
    assertCurrentStatus(
      currentStatus,
      SellerApprovalStatus.PENDING_APPROVAL,
      "approve",
    );
    assertTransitionAllowed(currentStatus, SellerApprovalStatus.ACTIVE);

    const updated = await this.repo.updateApprovalStatus(
      sellerId,
      SellerApprovalStatus.ACTIVE,
    );

    auditLogger.log({
      actorUserId,
      action: SELLER_ACTIONS.APPROVE,
      entityType: SELLER_AUDIT_ENTITY_TYPE,
      entityId: sellerId,
      metadata: {
        previousStatus: currentStatus,
        newStatus: SellerApprovalStatus.ACTIVE,
        userId: seller.userId,
        businessName: seller.businessName,
      },
    });

    notificationDispatcher.emit({
      eventType: NOTIFICATION_EVENTS.SELLER_APPROVED,
      correlationId: sellerId,
      inApp: {
        userId: seller.userId,
        type: NOTIFICATION_TYPES.SELLER_APPROVED,
        title: "Seller account approved",
        message: `Your seller account for ${seller.businessName} has been approved. You can now list and sell products.`,
      },
      email: {
        to: seller.user.email,
        recipientName: buildRecipientName(
          seller.user.firstName,
          seller.user.lastName,
        ),
        businessName: seller.businessName,
        dashboardUrl: buildAppUrl("/seller/dashboard"),
      },
    });

    return toSellerDetailDto(updated);
  }

  async rejectSeller(
    actorUserId: string,
    sellerId: string,
    input: RejectSellerInput = {},
  ): Promise<SellerDetailDto> {
    const seller = await this.repo.findById(sellerId);
    if (!seller) {
      throw new NotFoundError("Seller not found");
    }

    const currentStatus = seller.approvalStatus as SellerApprovalStatus;
    assertCurrentStatus(
      currentStatus,
      SellerApprovalStatus.PENDING_APPROVAL,
      "reject",
    );
    assertTransitionAllowed(currentStatus, SellerApprovalStatus.REJECTED);

    const updated = await this.repo.updateApprovalStatus(
      sellerId,
      SellerApprovalStatus.REJECTED,
    );

    auditLogger.log({
      actorUserId,
      action: SELLER_ACTIONS.REJECT,
      entityType: SELLER_AUDIT_ENTITY_TYPE,
      entityId: sellerId,
      metadata: {
        previousStatus: currentStatus,
        newStatus: SellerApprovalStatus.REJECTED,
        userId: seller.userId,
        businessName: seller.businessName,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    notificationDispatcher.emit({
      eventType: NOTIFICATION_EVENTS.SELLER_REJECTED,
      correlationId: sellerId,
      inApp: {
        userId: seller.userId,
        type: NOTIFICATION_TYPES.SELLER_REJECTED,
        title: "Seller account rejected",
        message: input.reason
          ? `Your seller application for ${seller.businessName} was rejected. Reason: ${input.reason}`
          : `Your seller application for ${seller.businessName} was rejected.`,
      },
      email: {
        to: seller.user.email,
        recipientName: buildRecipientName(
          seller.user.firstName,
          seller.user.lastName,
        ),
        businessName: seller.businessName,
        reason: input.reason,
        supportUrl: buildAppUrl("/support"),
      },
    });

    return toSellerDetailDto(updated);
  }

  async disableSeller(
    actorUserId: string,
    sellerId: string,
    input: DisableSellerInput = {},
  ): Promise<SellerDetailDto> {
    const seller = await this.repo.findById(sellerId);
    if (!seller) {
      throw new NotFoundError("Seller not found");
    }

    const currentStatus = seller.approvalStatus as SellerApprovalStatus;
    assertCurrentStatus(currentStatus, SellerApprovalStatus.ACTIVE, "disable");
    assertTransitionAllowed(currentStatus, SellerApprovalStatus.DISABLED);

    const updated = await this.repo.updateApprovalStatus(
      sellerId,
      SellerApprovalStatus.DISABLED,
    );

    auditLogger.log({
      actorUserId,
      action: SELLER_ACTIONS.DISABLE,
      entityType: SELLER_AUDIT_ENTITY_TYPE,
      entityId: sellerId,
      metadata: {
        previousStatus: currentStatus,
        newStatus: SellerApprovalStatus.DISABLED,
        userId: seller.userId,
        businessName: seller.businessName,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    notificationDispatcher.createInApp({
      userId: seller.userId,
      type: SELLER_NOTIFICATION_TYPES.DISABLED,
      title: "Seller account disabled",
      message: input.reason
        ? `Your seller account for ${seller.businessName} has been disabled. Reason: ${input.reason}`
        : `Your seller account for ${seller.businessName} has been disabled.`,
    });

    return toSellerDetailDto(updated);
  }

  async enableSeller(
    actorUserId: string,
    sellerId: string,
    input: EnableSellerInput = {},
  ): Promise<SellerDetailDto> {
    const seller = await this.repo.findById(sellerId);
    if (!seller) {
      throw new NotFoundError("Seller not found");
    }

    const currentStatus = seller.approvalStatus as SellerApprovalStatus;
    assertCurrentStatus(currentStatus, SellerApprovalStatus.DISABLED, "re-enable");
    assertTransitionAllowed(currentStatus, SellerApprovalStatus.ACTIVE);

    const updated = await this.repo.updateApprovalStatus(
      sellerId,
      SellerApprovalStatus.ACTIVE,
    );

    auditLogger.log({
      actorUserId,
      action: SELLER_ACTIONS.ENABLE,
      entityType: SELLER_AUDIT_ENTITY_TYPE,
      entityId: sellerId,
      metadata: {
        previousStatus: currentStatus,
        newStatus: SellerApprovalStatus.ACTIVE,
        userId: seller.userId,
        businessName: seller.businessName,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    notificationDispatcher.createInApp({
      userId: seller.userId,
      type: SELLER_NOTIFICATION_TYPES.ENABLED,
      title: "Seller account re-enabled",
      message: input.reason
        ? `Your seller account for ${seller.businessName} has been re-enabled. Reason: ${input.reason}`
        : `Your seller account for ${seller.businessName} has been re-enabled.`,
    });

    return toSellerDetailDto(updated);
  }
}
