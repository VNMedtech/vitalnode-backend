/**
 * @transaction-owner
 * @idempotent: yes
 * @external-calls: none
 */
import {
  FulfillmentMethod,
  OrderStatus,
  ShipmentStatus,
} from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";
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
import { ShipmentRepository } from "../repositories/shipment.repository.js";
import type { AssignDeliveryPartnerInput, OrderDetailDto } from "../types/order.types.js";

/** Internal DP assign/reassign only while order is CONFIRMED (before SHIPPED). */
const ASSIGNABLE_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.CONFIRMED,
]);

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

  private assertAssignableInternalDp(
    orderStatus: OrderStatus,
    method: FulfillmentMethod | undefined,
  ): void {
    if (!ASSIGNABLE_ORDER_STATUSES.has(orderStatus)) {
      throw new ConflictError(
        `Delivery partner can only be assigned while order is CONFIRMED (current: ${orderStatus})`,
      );
    }

    if (method !== FulfillmentMethod.INTERNAL_DP) {
      throw new ConflictError(
        "Delivery partner can only be assigned for INTERNAL_DP fulfillment",
      );
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

    if (!order.shipment) {
      throw new ConflictError(
        "Set fulfillment method to INTERNAL_DP before assigning a delivery partner",
      );
    }

    await this.validateDeliveryPartner(input.deliveryPartnerId);
    await this.validateSeller(order.sellerId);

    const from = order.orderStatus;
    this.assertAssignableInternalDp(from, order.shipment.method);

    if (order.deliveryPartnerId || order.shipment.deliveryPartnerId) {
      throw new ConflictError(
        "Order already has a delivery partner; use reassign instead",
      );
    }

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);
      const shipmentRepo = new ShipmentRepository(tx);

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
        nextStatus: from,
        deliveryPartnerId: input.deliveryPartnerId,
      });

      if (updated.count !== 1) {
        throw new ConflictError("Delivery partner assignment failed");
      }

      await shipmentRepo.assignDeliveryPartner({
        orderId,
        deliveryPartnerId: input.deliveryPartnerId,
        status: ShipmentStatus.READY,
      });

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.DELIVERY_PARTNER_ASSIGNED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          previousStatus: from,
          newStatus: from,
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

    if (!order.shipment) {
      throw new ConflictError(
        "Set fulfillment method to INTERNAL_DP before reassigning a delivery partner",
      );
    }

    this.assertAssignableInternalDp(order.orderStatus, order.shipment.method);

    const currentPartnerId =
      order.shipment.deliveryPartnerId ?? order.deliveryPartnerId;

    if (!currentPartnerId) {
      throw new ConflictError("Order has no delivery partner to reassign");
    }

    if (currentPartnerId === input.deliveryPartnerId) {
      return toOrderDetailDto(order);
    }

    await this.validateDeliveryPartner(input.deliveryPartnerId);
    await this.validateSeller(order.sellerId);

    const previousPartnerId = currentPartnerId;
    const expectedStatus = order.orderStatus;

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);
      const shipmentRepo = new ShipmentRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked) {
        throw new NotFoundError("Order not found");
      }

      if (locked.orderStatus !== expectedStatus) {
        throw new ConflictError("Order status has changed");
      }

      const updated = await orderRepo.reassignDeliveryPartner({
        orderId,
        expectedStatus,
        deliveryPartnerId: input.deliveryPartnerId,
      });

      if (updated.count !== 1) {
        throw new ConflictError("Delivery partner reassignment failed");
      }

      await shipmentRepo.assignDeliveryPartner({
        orderId,
        deliveryPartnerId: input.deliveryPartnerId,
        status: ShipmentStatus.READY,
      });

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.DELIVERY_PARTNER_REASSIGNED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          previousStatus: expectedStatus,
          newStatus: expectedStatus,
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
