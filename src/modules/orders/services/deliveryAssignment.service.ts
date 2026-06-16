/**
 * @transaction-owner
 * @idempotent: yes
 * @external-calls: none
 */
import { OrderStatus } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import { canTransitionOrderStatus } from "../../../shared/stateMachine/orderStatus.guard.js";
import { runInTransaction } from "../../../shared/transactions/runInTransaction.js";
import { recordCommerceAudit } from "../../auditLogs/services/commerceAudit.service.js";
import { DeliveryPartnerRepository } from "../../deliveryPartners/repositories/deliveryPartner.repository.js";
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
import type { AssignDeliveryPartnerInput, OrderDetailDto } from "../types/order.types.js";

export class DeliveryAssignmentService {
  private readonly orderRepo = new OrderRepository(prisma);
  private readonly deliveryPartnerRepo = new DeliveryPartnerRepository(prisma);
  private readonly sellerRepo = new SellerRepository(prisma);

  private async validateDeliveryPartner(deliveryPartnerId: string): Promise<void> {
    const partner = await this.deliveryPartnerRepo.findById(deliveryPartnerId);
    if (!partner) {
      throw new NotFoundError("Delivery partner not found");
    }

    if (partner.user.status !== UserStatus.ACTIVE) {
      throw new ValidationError("Delivery partner account is not active");
    }
  }

  private async validateSeller(sellerId: string): Promise<void> {
    const seller = await this.sellerRepo.findById(sellerId);
    if (!seller) {
      throw new NotFoundError("Seller not found");
    }

    if (seller.approvalStatus !== SellerApprovalStatus.ACTIVE) {
      throw new ValidationError("Seller is not active");
    }

    if (seller.user.status !== UserStatus.ACTIVE) {
      throw new ValidationError("Seller account is not active");
    }
  }

  async assignDeliveryPartner(
    actorUserId: string,
    orderId: string,
    input: AssignDeliveryPartnerInput,
  ): Promise<OrderDetailDto> {
    const order = await this.orderRepo.findDetailById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    await this.validateDeliveryPartner(input.deliveryPartnerId);
    await this.validateSeller(order.sellerId);

    const from = order.orderStatus;
    const to = OrderStatus.ASSIGNED_DELIVERY_PARTNER;

    if (!canTransitionOrderStatus(from, to)) {
      throw new ConflictError(`Invalid order status transition: ${from} -> ${to}`);
    }

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked) {
        throw new NotFoundError("Order not found");
      }

      if (locked.orderStatus !== from) {
        throw new ConflictError("Order status has changed");
      }

      const updated = await orderRepo.assignDeliveryPartner({
        orderId,
        expectedStatus: from,
        nextStatus: to,
        deliveryPartnerId: input.deliveryPartnerId,
      });

      if (updated.count !== 1) {
        throw new ConflictError("Delivery partner assignment failed");
      }

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.DELIVERY_PARTNER_ASSIGNED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          previousStatus: from,
          newStatus: to,
          previousPartnerId: order.deliveryPartnerId,
          newPartnerId: input.deliveryPartnerId,
          assignmentType: "ASSIGNED",
        },
      });

      const detail = await orderRepo.findDetailById(orderId);
      if (!detail) {
        throw new NotFoundError("Order not found");
      }

      const deliveryAssignedEvent =
        await orderNotificationContextService.buildDeliveryAssignedEvent(
          orderId,
          input.deliveryPartnerId,
        );
      if (deliveryAssignedEvent) {
        notificationDispatcher.emit(deliveryAssignedEvent);
      }

      return toOrderDetailDto(detail);
    });
  }

  async reassignDeliveryPartner(
    actorUserId: string,
    orderId: string,
    input: AssignDeliveryPartnerInput,
  ): Promise<OrderDetailDto> {
    const order = await this.orderRepo.findDetailById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (order.orderStatus !== OrderStatus.ASSIGNED_DELIVERY_PARTNER) {
      throw new ConflictError(
        "Delivery partner can only be reassigned when order is assigned",
      );
    }

    if (!order.deliveryPartnerId) {
      throw new ConflictError("Order has no delivery partner to reassign");
    }

    if (order.deliveryPartnerId === input.deliveryPartnerId) {
      return toOrderDetailDto(order);
    }

    await this.validateDeliveryPartner(input.deliveryPartnerId);
    await this.validateSeller(order.sellerId);

    const previousPartnerId = order.deliveryPartnerId;

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked) {
        throw new NotFoundError("Order not found");
      }

      if (locked.orderStatus !== OrderStatus.ASSIGNED_DELIVERY_PARTNER) {
        throw new ConflictError("Order status has changed");
      }

      const updated = await orderRepo.reassignDeliveryPartner({
        orderId,
        expectedStatus: OrderStatus.ASSIGNED_DELIVERY_PARTNER,
        deliveryPartnerId: input.deliveryPartnerId,
      });

      if (updated.count !== 1) {
        throw new ConflictError("Delivery partner reassignment failed");
      }

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.DELIVERY_PARTNER_REASSIGNED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          previousStatus: OrderStatus.ASSIGNED_DELIVERY_PARTNER,
          newStatus: OrderStatus.ASSIGNED_DELIVERY_PARTNER,
          previousPartnerId,
          newPartnerId: input.deliveryPartnerId,
          assignmentType: "REASSIGNED",
        },
      });

      const detail = await orderRepo.findDetailById(orderId);
      if (!detail) {
        throw new NotFoundError("Order not found");
      }

      const deliveryAssignedEvent =
        await orderNotificationContextService.buildDeliveryAssignedEvent(
          orderId,
          input.deliveryPartnerId,
        );
      if (deliveryAssignedEvent) {
        notificationDispatcher.emit(deliveryAssignedEvent);
      }

      return toOrderDetailDto(detail);
    });
  }
}
