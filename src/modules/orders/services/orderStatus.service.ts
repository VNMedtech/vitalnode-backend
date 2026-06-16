/**
 * @transaction-owner
 * @idempotent: yes (status guards + conditional updates)
 * @external-calls: none
 */
import {
  OrderStatus,
  ProofType,
} from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import {
  assertOrderStatusTransition,
  canTransitionOrderStatus,
} from "../../../shared/stateMachine/orderStatus.guard.js";
import { runInTransaction } from "../../../shared/transactions/runInTransaction.js";
import { recordCommerceAudit } from "../../auditLogs/services/commerceAudit.service.js";
import { SellerRepository } from "../../sellers/repositories/seller.repository.js";
import {
  ORDER_ACTIONS,
  ORDER_AUDIT_ENTITY_TYPE,
} from "../constants/order.constants.js";
import { toOrderDetailDto } from "../dto/order.dto.js";
import {
  notificationDispatcher,
  orderNotificationContextService,
} from "../../notifications/index.js";
import { OrderRepository } from "../repositories/order.repository.js";
import { OrderProofRepository } from "../repositories/orderProof.repository.js";
import type {
  DeliveryFailedInput,
  OrderDetailDto,
  OrderProofInput,
} from "../types/order.types.js";

function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrderStatus(from, to)) {
    throw new ConflictError(`Invalid order status transition: ${from} -> ${to}`);
  }
}

export class OrderStatusService {
  private readonly orderRepo = new OrderRepository(prisma);
  private readonly sellerRepo = new SellerRepository(prisma);

  private async resolveSellerId(actorUserId: string): Promise<string> {
    const seller = await this.sellerRepo.findIdByUserId(actorUserId);
    if (!seller) {
      throw new ForbiddenError("Seller profile required");
    }
    return seller.id;
  }

  private async resolveDeliveryPartnerId(
    actorUserId: string,
  ): Promise<string> {
    const partner = await prisma.deliveryPartnerProfile.findUnique({
      where: { userId: actorUserId },
      select: { id: true },
    });
    if (!partner) {
      throw new ForbiddenError("Delivery partner profile required");
    }
    return partner.id;
  }

  private async getSellerOrderOrThrow(orderId: string, sellerId: string) {
    const order = await this.orderRepo.findDetailByIdForSeller(orderId, sellerId);
    if (!order) {
      throw new NotFoundError("Order not found");
    }
    return order;
  }

  private async getDeliveryPartnerOrderOrThrow(
    orderId: string,
    deliveryPartnerId: string,
  ) {
    const order = await this.orderRepo.findDetailByIdForDeliveryPartner(
      orderId,
      deliveryPartnerId,
    );
    if (!order) {
      throw new NotFoundError("Order not found");
    }
    return order;
  }

  async processOrder(
    actorUserId: string,
    orderId: string,
  ): Promise<OrderDetailDto> {
    const sellerId = await this.resolveSellerId(actorUserId);
    const order = await this.getSellerOrderOrThrow(orderId, sellerId);

    const from = order.orderStatus;
    const to = OrderStatus.PROCESSING;
    assertTransition(from, to);

    if (from !== OrderStatus.ASSIGNED_DELIVERY_PARTNER) {
      throw new ConflictError("Order must have an assigned delivery partner");
    }

    return this.transitionOrder(actorUserId, orderId, from, to, {
      processedByRole: UserRole.SELLER,
    });
  }

  async uploadHandoverProof(
    actorUserId: string,
    orderId: string,
    input: OrderProofInput,
  ): Promise<OrderDetailDto> {
    const sellerId = await this.resolveSellerId(actorUserId);
    const order = await this.getSellerOrderOrThrow(orderId, sellerId);

    if (order.orderStatus !== OrderStatus.PROCESSING) {
      throw new ConflictError(
        "Handover proof can only be uploaded while order is processing",
      );
    }

    const existing = order.proofs.some(
      (proof) => proof.proofType === ProofType.HANDOVER,
    );
    if (existing) {
      throw new ConflictError("Handover proof already uploaded for this order");
    }

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);
      const proofRepo = new OrderProofRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked || locked.sellerId !== sellerId) {
        throw new NotFoundError("Order not found");
      }

      if (locked.orderStatus !== OrderStatus.PROCESSING) {
        throw new ConflictError("Order status has changed");
      }

      const duplicate = await proofRepo.existsByOrderIdAndType(
        orderId,
        ProofType.HANDOVER,
      );
      if (duplicate) {
        throw new ConflictError("Handover proof already uploaded for this order");
      }

      await proofRepo.create({
        orderId,
        proofType: ProofType.HANDOVER,
        fileUrl: input.fileUrl,
        uploadedBy: actorUserId,
      });

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.HANDOVER_PROOF_UPLOADED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          proofType: ProofType.HANDOVER,
          fileUrl: input.fileUrl,
        },
      });

      const detail = await orderRepo.findDetailByIdForSeller(orderId, sellerId);
      if (!detail) {
        throw new NotFoundError("Order not found");
      }

      return toOrderDetailDto(detail);
    });
  }

  async markOutForDelivery(
    actorUserId: string,
    orderId: string,
    input?: Partial<OrderProofInput>,
  ): Promise<OrderDetailDto> {
    const sellerId = await this.resolveSellerId(actorUserId);
    const order = await this.getSellerOrderOrThrow(orderId, sellerId);

    const from = order.orderStatus;
    const to = OrderStatus.OUT_FOR_DELIVERY;
    assertTransition(from, to);

    if (!order.deliveryPartnerId) {
      throw new ValidationError("Delivery partner must be assigned");
    }

    const hasHandoverProof = order.proofs.some(
      (proof) => proof.proofType === ProofType.HANDOVER,
    );
    if (!hasHandoverProof && !input?.fileUrl) {
      throw new ValidationError(
        "Handover proof must be uploaded before marking out for delivery",
      );
    }

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);
      const proofRepo = new OrderProofRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked || locked.sellerId !== sellerId) {
        throw new NotFoundError("Order not found");
      }

      if (locked.orderStatus !== from) {
        throw new ConflictError("Order status has changed");
      }

      assertOrderStatusTransition(from, to);

      if (input?.fileUrl) {
        const duplicate = await proofRepo.existsByOrderIdAndType(
          orderId,
          ProofType.HANDOVER,
        );
        if (!duplicate) {
          await proofRepo.create({
            orderId,
            proofType: ProofType.HANDOVER,
            fileUrl: input.fileUrl,
            uploadedBy: actorUserId,
          });
        }
      } else {
        const handoverProof = await proofRepo.existsByOrderIdAndType(
          orderId,
          ProofType.HANDOVER,
        );
        if (!handoverProof) {
          throw new ValidationError(
            "Handover proof must be uploaded before marking out for delivery",
          );
        }
      }

      const updated = await orderRepo.updateStatus({
        orderId,
        expectedStatus: from,
        nextStatus: to,
      });

      if (updated.count !== 1) {
        throw new ConflictError("Order status update failed");
      }

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.STATUS_CHANGED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          previousStatus: from,
          newStatus: to,
          proofType: ProofType.HANDOVER,
          deliveryPartnerId: order.deliveryPartnerId,
        },
      });

      const detail = await orderRepo.findDetailByIdForSeller(orderId, sellerId);
      if (!detail) {
        throw new NotFoundError("Order not found");
      }

      return toOrderDetailDto(detail);
    });
  }

  async uploadDeliveryProof(
    actorUserId: string,
    orderId: string,
    input: OrderProofInput,
  ): Promise<OrderDetailDto> {
    const deliveryPartnerId = await this.resolveDeliveryPartnerId(actorUserId);
    const order = await this.getDeliveryPartnerOrderOrThrow(
      orderId,
      deliveryPartnerId,
    );

    if (order.orderStatus !== OrderStatus.OUT_FOR_DELIVERY) {
      throw new ConflictError(
        "Delivery proof can only be uploaded while order is out for delivery",
      );
    }

    const existing = order.proofs.some(
      (proof) => proof.proofType === ProofType.DELIVERY,
    );
    if (existing) {
      throw new ConflictError("Delivery proof already uploaded for this order");
    }

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);
      const proofRepo = new OrderProofRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked) {
        throw new NotFoundError("Order not found");
      }

      if (locked.orderStatus !== OrderStatus.OUT_FOR_DELIVERY) {
        throw new ConflictError("Order status has changed");
      }

      const duplicate = await proofRepo.existsByOrderIdAndType(
        orderId,
        ProofType.DELIVERY,
      );
      if (duplicate) {
        throw new ConflictError("Delivery proof already uploaded for this order");
      }

      await proofRepo.create({
        orderId,
        proofType: ProofType.DELIVERY,
        fileUrl: input.fileUrl,
        uploadedBy: actorUserId,
      });

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.DELIVERY_PROOF_UPLOADED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          proofType: ProofType.DELIVERY,
          fileUrl: input.fileUrl,
        },
      });

      const detail = await orderRepo.findDetailByIdForDeliveryPartner(
        orderId,
        deliveryPartnerId,
      );
      if (!detail) {
        throw new NotFoundError("Order not found");
      }

      return toOrderDetailDto(detail);
    });
  }

  async markDelivered(
    actorUserId: string,
    orderId: string,
    input?: Partial<OrderProofInput>,
  ): Promise<OrderDetailDto> {
    const deliveryPartnerId = await this.resolveDeliveryPartnerId(actorUserId);
    const order = await this.getDeliveryPartnerOrderOrThrow(
      orderId,
      deliveryPartnerId,
    );

    const from = order.orderStatus;
    const to = OrderStatus.DELIVERED;
    assertTransition(from, to);

    const hasDeliveryProof = order.proofs.some(
      (proof) => proof.proofType === ProofType.DELIVERY,
    );
    if (!hasDeliveryProof && !input?.fileUrl) {
      throw new ValidationError(
        "Delivery proof must be uploaded before marking delivered",
      );
    }

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);
      const proofRepo = new OrderProofRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked) {
        throw new NotFoundError("Order not found");
      }

      if (locked.orderStatus !== from) {
        throw new ConflictError("Order status has changed");
      }

      assertOrderStatusTransition(from, to);

      if (input?.fileUrl) {
        const duplicate = await proofRepo.existsByOrderIdAndType(
          orderId,
          ProofType.DELIVERY,
        );
        if (!duplicate) {
          await proofRepo.create({
            orderId,
            proofType: ProofType.DELIVERY,
            fileUrl: input.fileUrl,
            uploadedBy: actorUserId,
          });
        }
      } else {
        const deliveryProof = await proofRepo.existsByOrderIdAndType(
          orderId,
          ProofType.DELIVERY,
        );
        if (!deliveryProof) {
          throw new ValidationError(
            "Delivery proof must be uploaded before marking delivered",
          );
        }
      }

      const updated = await orderRepo.updateStatus({
        orderId,
        expectedStatus: from,
        nextStatus: to,
      });

      if (updated.count !== 1) {
        throw new ConflictError("Order status update failed");
      }

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.STATUS_CHANGED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          previousStatus: from,
          newStatus: to,
          proofType: ProofType.DELIVERY,
        },
      });

      const detail = await orderRepo.findDetailByIdForDeliveryPartner(
        orderId,
        deliveryPartnerId,
      );
      if (!detail) {
        throw new NotFoundError("Order not found");
      }

      const orderDeliveredEvent =
        await orderNotificationContextService.buildOrderDeliveredEvent(orderId);
      if (orderDeliveredEvent) {
        notificationDispatcher.emit(orderDeliveredEvent);
      }

      return toOrderDetailDto(detail);
    });
  }

  async markDeliveryFailed(
    actorUserId: string,
    orderId: string,
    input: DeliveryFailedInput,
  ): Promise<OrderDetailDto> {
    const deliveryPartnerId = await this.resolveDeliveryPartnerId(actorUserId);
    const order = await this.getDeliveryPartnerOrderOrThrow(
      orderId,
      deliveryPartnerId,
    );

    const from = order.orderStatus;
    const to = OrderStatus.DELIVERY_FAILED;
    assertTransition(from, to);

    return this.transitionOrder(actorUserId, orderId, from, to, {
      reason: input.reason ?? null,
      processedByRole: UserRole.DELIVERY_PARTNER,
    });
  }

  private async transitionOrder(
    actorUserId: string,
    orderId: string,
    from: OrderStatus,
    to: OrderStatus,
    metadata: Record<string, unknown>,
  ): Promise<OrderDetailDto> {
    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked) {
        throw new NotFoundError("Order not found");
      }

      if (locked.orderStatus !== from) {
        throw new ConflictError("Order status has changed");
      }

      assertOrderStatusTransition(from, to);

      const updated = await orderRepo.updateStatus({
        orderId,
        expectedStatus: from,
        nextStatus: to,
      });

      if (updated.count !== 1) {
        throw new ConflictError("Order status update failed");
      }

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.STATUS_CHANGED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          previousStatus: from,
          newStatus: to,
          ...metadata,
        },
      });

      const detail = await orderRepo.findDetailById(orderId);
      if (!detail) {
        throw new NotFoundError("Order not found");
      }

      return toOrderDetailDto(detail);
    });
  }
}
