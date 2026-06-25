/**
 * @transaction-owner
 * @idempotent: yes
 * @external-calls: Razorpay refund (compensation path only, post-TX)
 */
import {
  OrderStatus,
  PaymentStatus,
  type Prisma,
} from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import { logger } from "../../../infrastructure/logger/logger.js";
import { razorpayClient } from "../../../infrastructure/razorpay/index.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import { runInTransaction } from "../../../shared/transactions/runInTransaction.js";
import { recordCommerceAudit } from "../../auditLogs/services/commerceAudit.service.js";
import { CartItemRepository } from "../../cart/repositories/cartItem.repository.js";
import { CartRepository } from "../../cart/repositories/cart.repository.js";
import { InventoryMovementService } from "../../inventory/services/inventoryMovement.service.js";
import { OrderRepository } from "../../orders/repositories/order.repository.js";
import {
  INVENTORY_ACTIONS,
  INVENTORY_AUDIT_ENTITY_TYPE,
  INSUFFICIENT_INVENTORY_FULFILLMENT_MESSAGE,
  ORDER_ACTIONS,
  ORDER_AUDIT_ENTITY_TYPE,
  PAYMENT_ACTIONS,
  PAYMENT_AUDIT_ENTITY_TYPE,
} from "../constants/payment.constants.js";
import {
  notificationDispatcher,
  orderNotificationContextService,
} from "../../notifications/index.js";
import { InvoiceGenerationService } from "../../invoices/services/invoiceGeneration.service.js";
import { PaymentRepository } from "../repositories/payment.repository.js";
import { amountsMatch, decimalToPaise } from "../utils/money.util.js";
import type {
  FulfillSuccessfulPaymentInput,
  PaymentFulfillmentResult,
} from "../types/payment.types.js";

type TxClient = Prisma.TransactionClient;

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

export class PaymentFulfillmentService {
  private readonly movementService = new InventoryMovementService();
  private readonly invoiceGenerationService = new InvoiceGenerationService();

  async fulfillSuccessfulPayment(
    input: FulfillSuccessfulPaymentInput,
  ): Promise<PaymentFulfillmentResult> {
    const payment = await new PaymentRepository(prisma).findByRazorpayOrderId(
      input.razorpayOrderId,
    );

    if (!payment) {
      throw new NotFoundError("Payment not found for Razorpay order");
    }

    if (payment.paymentStatus === PaymentStatus.SUCCESS) {
      await this.invoiceGenerationService.generateForOrder(
        payment.orderId,
        input.actorUserId,
      );
      return {
        orderId: payment.orderId,
        orderNumber: payment.order.orderNumber,
        orderStatus: payment.order.orderStatus,
        paymentStatus: payment.paymentStatus,
        alreadyFulfilled: true,
      };
    }

    if (!amountsMatch(payment.amount, input.amountPaise)) {
      throw new ValidationError("Payment amount mismatch");
    }

    if (payment.order.orderStatus !== OrderStatus.PENDING_PAYMENT) {
      throw new ConflictError("Order is not awaiting payment");
    }

    try {
      const result = await runInTransaction(async (tx) => {
        const paymentRepo = new PaymentRepository(tx);
        const orderRepo = new OrderRepository(tx);
        const cartRepo = new CartRepository(tx);
        const cartItemRepo = new CartItemRepository(tx);

        const lockedPayment = await paymentRepo.lockById(payment.id);
        if (!lockedPayment) {
          throw new NotFoundError("Payment not found");
        }

        if (lockedPayment.paymentStatus === PaymentStatus.SUCCESS) {
          return {
            orderId: lockedPayment.orderId,
            orderNumber: lockedPayment.order.orderNumber,
            orderStatus: lockedPayment.order.orderStatus,
            paymentStatus: lockedPayment.paymentStatus,
            alreadyFulfilled: true,
          };
        }

        if (lockedPayment.paymentStatus !== PaymentStatus.PENDING) {
          throw new ConflictError("Payment cannot be fulfilled");
        }

        const lockedOrder = await orderRepo.lockById(lockedPayment.orderId);
        if (!lockedOrder) {
          throw new NotFoundError("Order not found");
        }

        if (lockedOrder.orderStatus !== OrderStatus.PENDING_PAYMENT) {
          throw new ConflictError("Order is not awaiting payment");
        }

        const placedAt = new Date();
        const paymentUpdated = await paymentRepo.markSuccess({
          paymentId: lockedPayment.id,
          razorpayPaymentId: input.razorpayPaymentId,
        });

        if (paymentUpdated.count !== 1) {
          const current = await paymentRepo.findByRazorpayOrderId(
            input.razorpayOrderId,
          );
          if (current?.paymentStatus === PaymentStatus.SUCCESS) {
            return {
              orderId: current.orderId,
              orderNumber: current.order.orderNumber,
              orderStatus: current.order.orderStatus,
              paymentStatus: current.paymentStatus,
              alreadyFulfilled: true,
            };
          }
          throw new ConflictError("Payment fulfillment race lost");
        }

        for (const line of lockedOrder.items) {
          const productStatus = parseProductStatus(line.productSnapshot);
          const deduction = await this.movementService.deductForOrder(tx, {
            productId: line.productId,
            quantity: line.quantity,
            orderId: lockedOrder.id,
            actorUserId: input.actorUserId,
            currentProductStatus: productStatus,
          });

          if (!deduction.success) {
            throw new ConflictError(INSUFFICIENT_INVENTORY_FULFILLMENT_MESSAGE);
          }

          await recordCommerceAudit(tx, {
            actorUserId: input.actorUserId,
            action: INVENTORY_ACTIONS.DEDUCTED,
            entityType: INVENTORY_AUDIT_ENTITY_TYPE,
            entityId: line.productId,
            metadata: {
              productId: line.productId,
              quantity: line.quantity,
              movementType: "ORDER_DEDUCTION",
              referenceId: lockedOrder.id,
              availableQuantity: deduction.availableQuantity,
            },
          });
        }

        const orderUpdated = await orderRepo.markPlaced(
          lockedOrder.id,
          placedAt,
        );
        if (orderUpdated.count !== 1) {
          throw new ConflictError("Order placement failed");
        }

        const buyerCart = await cartRepo.findByBuyerId(lockedOrder.buyerId);
        if (buyerCart) {
          await cartItemRepo.deleteByCartIdAndProductIds(
            buyerCart.id,
            lockedOrder.items.map((item) => item.productId),
          );
        }

        await recordCommerceAudit(tx, {
          actorUserId: input.actorUserId,
          action: PAYMENT_ACTIONS.SUCCESS,
          entityType: PAYMENT_AUDIT_ENTITY_TYPE,
          entityId: lockedPayment.id,
          metadata: {
            razorpayOrderId: input.razorpayOrderId,
            razorpayPaymentId: input.razorpayPaymentId,
            amount: lockedPayment.amount.toString(),
            source: input.source,
          },
        });

        await recordCommerceAudit(tx, {
          actorUserId: input.actorUserId,
          action: ORDER_ACTIONS.PLACED,
          entityType: ORDER_AUDIT_ENTITY_TYPE,
          entityId: lockedOrder.id,
          metadata: {
            previousStatus: OrderStatus.PENDING_PAYMENT,
            newStatus: OrderStatus.PLACED,
            orderNumber: lockedOrder.orderNumber,
            placedAt: placedAt.toISOString(),
          },
        });

        return {
          orderId: lockedOrder.id,
          orderNumber: lockedOrder.orderNumber,
          orderStatus: OrderStatus.PLACED,
          paymentStatus: PaymentStatus.SUCCESS,
          alreadyFulfilled: false,
        };
      });

      if (!result.alreadyFulfilled) {
        const orderPlacedEvent =
          await orderNotificationContextService.buildOrderPlacedEvent(
            result.orderId,
          );
        if (orderPlacedEvent) {
          notificationDispatcher.emit(orderPlacedEvent);
        }
      }

      await this.invoiceGenerationService.generateForOrder(
        result.orderId,
        input.actorUserId,
      );

      return result;
    } catch (error) {
      if (
        error instanceof ConflictError &&
        error.message === INSUFFICIENT_INVENTORY_FULFILLMENT_MESSAGE
      ) {
        await this.compensateInsufficientInventory({
          actorUserId: input.actorUserId,
          paymentId: payment.id,
          orderId: payment.orderId,
          razorpayOrderId: input.razorpayOrderId,
          razorpayPaymentId: input.razorpayPaymentId,
          amount: payment.amount,
          source: input.source,
        });
      }
      throw error;
    }
  }

  /**
   * Razorpay captured funds but internal fulfillment TX rolled back (e.g. stock race).
   * Mark payment/order failed and initiate automatic refund (idempotent).
   */
  private async compensateInsufficientInventory(input: {
    actorUserId: string;
    paymentId: string;
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    amount: Prisma.Decimal;
    source: string;
  }): Promise<void> {
    const paymentRepo = new PaymentRepository(prisma);
    const current = await paymentRepo.findByOrderId(input.orderId);
    if (!current) {
      return;
    }

    if (current.paymentStatus === PaymentStatus.SUCCESS) {
      return;
    }

    const alreadyCompensated =
      current.paymentStatus === PaymentStatus.FAILED &&
      current.order.orderStatus === OrderStatus.PAYMENT_FAILED;

    if (!alreadyCompensated) {
      await runInTransaction(async (tx) => {
        const txPaymentRepo = new PaymentRepository(tx);
        const orderRepo = new OrderRepository(tx);

        const locked = await txPaymentRepo.lockById(input.paymentId);
        if (!locked || locked.paymentStatus === PaymentStatus.SUCCESS) {
          return;
        }

        if (locked.paymentStatus === PaymentStatus.PENDING) {
          const updated = await txPaymentRepo.markCapturedFulfillmentFailed({
            paymentId: input.paymentId,
            razorpayPaymentId: input.razorpayPaymentId,
          });

          if (updated.count !== 1) {
            return;
          }

          await orderRepo.updateStatus({
            orderId: input.orderId,
            expectedStatus: OrderStatus.PENDING_PAYMENT,
            nextStatus: OrderStatus.PAYMENT_FAILED,
          });

          await recordCommerceAudit(tx, {
            actorUserId: input.actorUserId,
            action: PAYMENT_ACTIONS.FULFILLMENT_COMPENSATION,
            entityType: PAYMENT_AUDIT_ENTITY_TYPE,
            entityId: input.paymentId,
            metadata: {
              razorpayOrderId: input.razorpayOrderId,
              razorpayPaymentId: input.razorpayPaymentId,
              orderId: input.orderId,
              amount: input.amount.toString(),
              reason: INSUFFICIENT_INVENTORY_FULFILLMENT_MESSAGE,
              source: input.source,
            },
          });
        }
      });
    }

    try {
      await razorpayClient.createRefund({
        paymentId: input.razorpayPaymentId,
        amountPaise: decimalToPaise(input.amount),
        notes: {
          orderId: input.orderId,
          reason: "fulfillment_inventory_failed",
          idempotencyKey: `compensation:${input.orderId}:${input.razorpayPaymentId}`,
        },
      });

      logger.warn(
        {
          orderId: input.orderId,
          razorpayPaymentId: input.razorpayPaymentId,
        },
        "Automatic compensation refund initiated after inventory fulfillment failure",
      );
    } catch (refundError) {
      logger.error(
        {
          orderId: input.orderId,
          razorpayPaymentId: input.razorpayPaymentId,
          message:
            refundError instanceof Error ? refundError.message : "Unknown error",
        },
        "CRITICAL: Compensation refund failed — manual Razorpay refund required",
      );
    }
  }

  async markPaymentFailed(input: {
    actorUserId: string;
    razorpayOrderId: string;
    reason?: string;
  }): Promise<void> {
    const payment = await new PaymentRepository(prisma).findByRazorpayOrderId(
      input.razorpayOrderId,
    );
    if (!payment || payment.paymentStatus !== PaymentStatus.PENDING) {
      return;
    }

    await runInTransaction(async (tx) => {
      const paymentRepo = new PaymentRepository(tx);

      const locked = await paymentRepo.lockById(payment.id);
      if (!locked || locked.paymentStatus !== PaymentStatus.PENDING) {
        return;
      }

      await paymentRepo.markFailed(locked.id);
      await tx.order.updateMany({
        where: {
          id: locked.orderId,
          orderStatus: OrderStatus.PENDING_PAYMENT,
        },
        data: { orderStatus: OrderStatus.PAYMENT_FAILED },
      });

      await recordCommerceAudit(tx, {
        actorUserId: input.actorUserId,
        action: PAYMENT_ACTIONS.FAILED,
        entityType: PAYMENT_AUDIT_ENTITY_TYPE,
        entityId: locked.id,
        metadata: {
          razorpayOrderId: input.razorpayOrderId,
          reason: input.reason ?? null,
        },
      });
    });
  }
}
