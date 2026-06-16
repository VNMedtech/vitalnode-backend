/**
 * @transaction-owner
 * @idempotent: yes (inventory restore dedupe + status guards)
 * @external-calls: Razorpay refund (post-TX via RefundService)
 */
import { OrderStatus, type Prisma } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import { logger } from "../../../infrastructure/logger/logger.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { canTransitionOrderStatus } from "../../../shared/stateMachine/orderStatus.guard.js";
import { withIdempotency } from "../../../shared/idempotency/withIdempotency.js";
import { runInTransaction } from "../../../shared/transactions/runInTransaction.js";
import { recordCommerceAudit } from "../../auditLogs/services/commerceAudit.service.js";
import { INVENTORY_ACTIONS } from "../../inventory/constants/inventory.constants.js";
import { InventoryMovementService } from "../../inventory/services/inventoryMovement.service.js";
import { RefundService } from "../../payments/services/refund.service.js";
import { BuyerRepository } from "../../buyers/repositories/buyer.repository.js";
import { SellerRepository } from "../../sellers/repositories/seller.repository.js";
import {
  CANCELLABLE_ORDER_STATUSES,
  ORDER_ACTIONS,
  ORDER_AUDIT_ENTITY_TYPE,
  ORDER_ROUTES,
} from "../constants/order.constants.js";
import { toOrderDetailDto } from "../dto/order.dto.js";
import {
  notificationDispatcher,
  orderNotificationContextService,
} from "../../notifications/index.js";
import { OrderRepository } from "../repositories/order.repository.js";
import type { CancelOrderInput, OrderDetailDto } from "../types/order.types.js";

function parseProductStatus(snapshot: Prisma.JsonValue): ProductStatus {
  if (
    typeof snapshot === "object" &&
    snapshot !== null &&
    "status" in snapshot &&
    typeof snapshot.status === "string"
  ) {
    return snapshot.status as ProductStatus;
  }
  return ProductStatus.APPROVED;
}

function isCancellableStatus(status: OrderStatus): boolean {
  return (CANCELLABLE_ORDER_STATUSES as readonly string[]).includes(status);
}

export class OrderCancellationService {
  private readonly orderRepo = new OrderRepository(prisma);
  private readonly buyerRepo = new BuyerRepository(prisma);
  private readonly sellerRepo = new SellerRepository(prisma);
  private readonly movementService = new InventoryMovementService();
  private readonly refundService = new RefundService();

  private async resolveBuyerId(actorUserId: string): Promise<string> {
    const buyer = await this.buyerRepo.findIdByUserId(actorUserId);
    if (!buyer) {
      throw new ForbiddenError("Buyer profile required");
    }
    return buyer.id;
  }

  private async resolveSellerId(actorUserId: string): Promise<string> {
    const seller = await this.sellerRepo.findIdByUserId(actorUserId);
    if (!seller) {
      throw new ForbiddenError("Seller profile required");
    }
    return seller.id;
  }

  private assertActorCanCancel(
    role: UserRole,
    order: { buyerId: string; sellerId: string },
    actorUserId: string,
    buyerId?: string,
    sellerId?: string,
  ): void {
    if (role === UserRole.ADMIN) {
      return;
    }

    if (role === UserRole.BUYER) {
      if (!buyerId || order.buyerId !== buyerId) {
        throw new ForbiddenError("Order does not belong to this buyer");
      }
      return;
    }

    if (role === UserRole.SELLER) {
      if (!sellerId || order.sellerId !== sellerId) {
        throw new ForbiddenError("Order does not belong to this seller");
      }
      return;
    }

    throw new ForbiddenError("Not authorized to cancel this order");
  }

  async cancelOrder(
    actorUserId: string,
    role: UserRole,
    orderId: string,
    reason?: string,
    idempotencyKey?: string,
  ): Promise<OrderDetailDto> {
    const execute = async () => {
      let buyerId: string | undefined;
      let sellerId: string | undefined;

      if (role === UserRole.BUYER) {
        buyerId = await this.resolveBuyerId(actorUserId);
      } else if (role === UserRole.SELLER) {
        sellerId = await this.resolveSellerId(actorUserId);
      }

      const order = await this.orderRepo.findByIdWithPaymentAndItems(orderId);
      if (!order) {
        throw new NotFoundError("Order not found");
      }

      this.assertActorCanCancel(role, order, actorUserId, buyerId, sellerId);

      if (order.orderStatus === OrderStatus.CANCELLED) {
        const detail = await this.orderRepo.findDetailById(orderId);
        if (!detail) {
          throw new NotFoundError("Order not found");
        }
        return toOrderDetailDto(detail);
      }

      if (!isCancellableStatus(order.orderStatus)) {
        throw new ConflictError("Order cannot be cancelled in its current status");
      }

      const from = order.orderStatus;
      const to = OrderStatus.CANCELLED;

      if (!canTransitionOrderStatus(from, to)) {
        throw new ConflictError(`Invalid order status transition: ${from} -> ${to}`);
      }

      let didCancel = false;

      await runInTransaction(async (tx) => {
        const orderRepo = new OrderRepository(tx);

        const locked = await orderRepo.lockById(orderId);
        if (!locked) {
          throw new NotFoundError("Order not found");
        }

        if (locked.orderStatus === OrderStatus.CANCELLED) {
          return;
        }

        if (!isCancellableStatus(locked.orderStatus)) {
          throw new ConflictError("Order cannot be cancelled in its current status");
        }

        if (!canTransitionOrderStatus(locked.orderStatus, to)) {
          throw new ConflictError(
            `Invalid order status transition: ${locked.orderStatus} -> ${to}`,
          );
        }

        for (const line of locked.items) {
          const productStatus = parseProductStatus(line.productSnapshot);
          const restore = await this.movementService.restoreForOrder(tx, {
            productId: line.productId,
            quantity: line.quantity,
            orderId,
            actorUserId,
            currentProductStatus: productStatus,
          });

          if (restore.restored) {
            await recordCommerceAudit(tx, {
              actorUserId,
              action: INVENTORY_ACTIONS.RESTORED,
              entityType: "INVENTORY",
              entityId: line.productId,
              metadata: {
                productId: line.productId,
                quantity: line.quantity,
                movementType: "ORDER_RESTORE",
                referenceId: orderId,
                availableQuantity: restore.availableQuantity,
              },
            });
          }
        }

        const updated = await orderRepo.updateStatus({
          orderId,
          expectedStatus: locked.orderStatus,
          nextStatus: to,
        });

        if (updated.count !== 1) {
          throw new ConflictError("Order cancellation failed");
        }

        didCancel = true;

        await recordCommerceAudit(tx, {
          actorUserId,
          action: ORDER_ACTIONS.CANCELLED,
          entityType: ORDER_AUDIT_ENTITY_TYPE,
          entityId: orderId,
          metadata: {
            previousStatus: locked.orderStatus,
            newStatus: to,
            reason: reason ?? null,
            cancelledByRole: role,
          },
        });
      });

      try {
        await this.refundService.initiateRefund(actorUserId, { orderId });
      } catch (error) {
        logger.error(
          {
            orderId,
            message: error instanceof Error ? error.message : "Unknown error",
          },
          "Refund initiation failed after order cancellation — retry via POST /api/v1/payments/refund",
        );
      }

      const detail = await this.orderRepo.findDetailById(orderId);
      if (!detail) {
        throw new NotFoundError("Order not found");
      }

      if (didCancel) {
        const orderCancelledEvent =
          await orderNotificationContextService.buildOrderCancelledEvent(
            orderId,
            reason,
          );
        if (orderCancelledEvent) {
          notificationDispatcher.emit(orderCancelledEvent);
        }
      }

      return toOrderDetailDto(detail);
    };

    if (!idempotencyKey) {
      return execute();
    }

    const route =
      role === UserRole.BUYER ? ORDER_ROUTES.CANCEL : ORDER_ROUTES.ADMIN_CANCEL;

    return withIdempotency({
      actorUserId,
      key: idempotencyKey,
      route,
      requestHash: orderId,
      handler: execute,
    });
  }

  async cancelOrderByBuyer(
    actorUserId: string,
    input: CancelOrderInput,
    idempotencyKey?: string,
  ): Promise<OrderDetailDto> {
    return this.cancelOrder(
      actorUserId,
      UserRole.BUYER,
      input.orderId,
      input.reason,
      idempotencyKey,
    );
  }
}
