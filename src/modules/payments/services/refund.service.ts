/**
 * @transaction-owner (refund status TX)
 * @idempotent: yes
 * @external-calls: Razorpay payments.refund (initiate only)
 */
import {
  OrderStatus,
  PaymentStatus,
  RefundStatus,
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
import { withIdempotency } from "../../../shared/idempotency/withIdempotency.js";
import { runInTransaction } from "../../../shared/transactions/runInTransaction.js";
import { recordCommerceAudit } from "../../auditLogs/services/commerceAudit.service.js";
import { OrderRepository } from "../../orders/repositories/order.repository.js";
import {
  ORDER_ACTIONS,
  ORDER_AUDIT_ENTITY_TYPE,
  PAYMENT_ACTIONS,
  PAYMENT_AUDIT_ENTITY_TYPE,
  PAYMENT_ROUTES,
} from "../constants/payment.constants.js";
import { toRefundPaymentDto } from "../dto/payment.dto.js";
import { PaymentRepository } from "../repositories/payment.repository.js";
import { amountsMatch, decimalToPaise } from "../utils/money.util.js";
import type {
  CompleteRefundInput,
  InitiateRefundInput,
  RefundResult,
} from "../types/payment.types.js";

export class RefundService {
  private readonly paymentRepo = new PaymentRepository(prisma);
  private readonly orderRepo = new OrderRepository(prisma);

  async initiateRefund(
    actorUserId: string,
    input: InitiateRefundInput,
    idempotencyKey?: string,
  ) {
    const execute = async () => {
      const order = await this.orderRepo.findByIdWithPaymentAndItems(
        input.orderId,
      );

      if (!order?.payment) {
        throw new NotFoundError("Order or payment not found");
      }

      if (order.orderStatus !== OrderStatus.CANCELLED) {
        throw new ConflictError("Order must be cancelled before refund");
      }

      if (order.payment.paymentStatus !== PaymentStatus.SUCCESS) {
        throw new ConflictError("Payment must be successful to refund");
      }

      if (order.payment.refundStatus === RefundStatus.SUCCESS) {
        return toRefundPaymentDto({
          orderId: order.id,
          orderStatus: order.orderStatus,
          refundStatus: order.payment.refundStatus,
          alreadyCompleted: true,
        });
      }

      if (order.payment.refundStatus === RefundStatus.PENDING) {
        return this.retryPendingRazorpayRefund(actorUserId, {
          id: order.id,
          orderStatus: order.orderStatus,
          payment: order.payment,
        });
      }

      if (
        order.payment.refundStatus !== RefundStatus.NOT_APPLICABLE &&
        order.payment.refundStatus !== RefundStatus.FAILED
      ) {
        throw new ConflictError("Refund cannot be initiated");
      }

      const paymentSnapshot = order.payment;

      const lockedPaymentId = await runInTransaction(async (tx) => {
        const paymentRepo = new PaymentRepository(tx);
        const locked = await paymentRepo.lockById(paymentSnapshot.id);
        if (!locked) {
          throw new NotFoundError("Payment not found");
        }

        if (locked.refundStatus === RefundStatus.SUCCESS) {
          return null;
        }

        if (locked.refundStatus === RefundStatus.PENDING) {
          return locked.id;
        }

        const updated = await paymentRepo.markRefundPending(locked.id);
        if (updated.count !== 1) {
          throw new ConflictError("Refund could not be initiated");
        }

        await recordCommerceAudit(tx, {
          actorUserId,
          action: PAYMENT_ACTIONS.REFUND_INITIATED,
          entityType: PAYMENT_AUDIT_ENTITY_TYPE,
          entityId: locked.id,
          metadata: {
            orderId: order.id,
            razorpayPaymentId: locked.razorpayPaymentId,
            amount: locked.amount.toString(),
          },
        });

        return locked.id;
      });

      if (!lockedPaymentId) {
        return toRefundPaymentDto({
          orderId: order.id,
          orderStatus: order.orderStatus,
          refundStatus: RefundStatus.SUCCESS,
          alreadyCompleted: true,
        });
      }

      return this.executeRazorpayRefund(actorUserId, {
        orderId: order.id,
        orderStatus: order.orderStatus,
        paymentId: paymentSnapshot.id,
        razorpayPaymentId: paymentSnapshot.razorpayPaymentId,
        amount: paymentSnapshot.amount,
      });
    };

    if (!idempotencyKey) {
      return execute();
    }

    return withIdempotency({
      actorUserId,
      key: idempotencyKey,
      route: PAYMENT_ROUTES.REFUND,
      requestHash: input.orderId,
      handler: execute,
    });
  }

  async completeRefund(input: CompleteRefundInput): Promise<RefundResult> {
    const payment = await this.paymentRepo.findByOrderId(input.orderId);
    if (!payment) {
      throw new NotFoundError("Payment not found");
    }

    if (payment.refundStatus === RefundStatus.SUCCESS) {
      return {
        orderId: payment.orderId,
        orderStatus: payment.order.orderStatus,
        refundStatus: payment.refundStatus,
        alreadyCompleted: true,
      };
    }

    if (!amountsMatch(payment.amount, input.amountPaise)) {
      throw new ValidationError("Refund amount mismatch");
    }

    return runInTransaction(async (tx) => {
      const paymentRepo = new PaymentRepository(tx);
      const orderRepo = new OrderRepository(tx);

      const locked = await paymentRepo.lockById(payment.id);
      if (!locked) {
        throw new NotFoundError("Payment not found");
      }

      if (locked.refundStatus === RefundStatus.SUCCESS) {
        return {
          orderId: locked.orderId,
          orderStatus: locked.order.orderStatus,
          refundStatus: locked.refundStatus,
          alreadyCompleted: true,
        };
      }

      if (locked.refundStatus !== RefundStatus.PENDING) {
        throw new ConflictError("Refund is not pending");
      }

      const refundUpdated = await paymentRepo.markRefundSuccess(locked.id);
      if (refundUpdated.count !== 1) {
        const current = await paymentRepo.findByOrderId(input.orderId);
        if (current?.refundStatus === RefundStatus.SUCCESS) {
          return {
            orderId: current.orderId,
            orderStatus: current.order.orderStatus,
            refundStatus: current.refundStatus,
            alreadyCompleted: true,
          };
        }
        throw new ConflictError("Refund completion race lost");
      }

      const orderUpdated = await orderRepo.markRefunded(locked.orderId);
      if (orderUpdated.count !== 1) {
        throw new ConflictError("Order could not be marked refunded");
      }

      await recordCommerceAudit(tx, {
        actorUserId: input.actorUserId,
        action: PAYMENT_ACTIONS.REFUND_SUCCESS,
        entityType: PAYMENT_AUDIT_ENTITY_TYPE,
        entityId: locked.id,
        metadata: {
          orderId: locked.orderId,
          razorpayPaymentId: input.razorpayPaymentId,
          amount: locked.amount.toString(),
          source: input.source,
        },
      });

      await recordCommerceAudit(tx, {
        actorUserId: input.actorUserId,
        action: ORDER_ACTIONS.REFUNDED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: locked.orderId,
        metadata: {
          previousStatus: OrderStatus.CANCELLED,
          newStatus: OrderStatus.REFUNDED,
        },
      });

      return {
        orderId: locked.orderId,
        orderStatus: OrderStatus.REFUNDED,
        refundStatus: RefundStatus.SUCCESS,
        alreadyCompleted: false,
      };
    });
  }

  private async retryPendingRazorpayRefund(
    actorUserId: string,
    order: {
      id: string;
      orderStatus: OrderStatus;
      payment: {
        id: string;
        razorpayPaymentId: string | null;
        amount: Prisma.Decimal;
      };
    },
  ) {
    logger.info(
      { orderId: order.id, paymentId: order.payment.id },
      "Retrying Razorpay refund for pending refund status",
    );

    return this.executeRazorpayRefund(actorUserId, {
      orderId: order.id,
      orderStatus: order.orderStatus,
      paymentId: order.payment.id,
      razorpayPaymentId: order.payment.razorpayPaymentId,
      amount: order.payment.amount,
    });
  }

  private async executeRazorpayRefund(
    actorUserId: string,
    input: {
      orderId: string;
      orderStatus: OrderStatus;
      paymentId: string;
      razorpayPaymentId: string | null;
      amount: Prisma.Decimal;
    },
  ) {
    if (!input.razorpayPaymentId) {
      throw new ValidationError("Razorpay payment id missing for refund");
    }

    try {
      await razorpayClient.createRefund({
        paymentId: input.razorpayPaymentId,
        amountPaise: decimalToPaise(input.amount),
        notes: {
          orderId: input.orderId,
          idempotencyKey: `refund:${input.orderId}:${input.paymentId}`,
        },
      });
    } catch (error) {
      await this.markRefundFailed({
        actorUserId,
        orderId: input.orderId,
        reason:
          error instanceof Error
            ? `Razorpay refund API failed: ${error.message}`
            : "Razorpay refund API failed",
      });
      throw error;
    }

    const refreshed = await this.paymentRepo.findByOrderId(input.orderId);
    return toRefundPaymentDto({
      orderId: input.orderId,
      orderStatus: input.orderStatus,
      refundStatus: refreshed?.refundStatus ?? RefundStatus.PENDING,
      alreadyCompleted: false,
    });
  }

  async markRefundFailed(input: {
    actorUserId: string;
    orderId: string;
    reason?: string;
  }): Promise<void> {
    const payment = await this.paymentRepo.findByOrderId(input.orderId);
    if (!payment || payment.refundStatus !== RefundStatus.PENDING) {
      return;
    }

    await runInTransaction(async (tx) => {
      const paymentRepo = new PaymentRepository(tx);
      const locked = await paymentRepo.lockById(payment.id);
      if (!locked || locked.refundStatus !== RefundStatus.PENDING) {
        return;
      }

      await paymentRepo.markRefundFailed(locked.id);

      await recordCommerceAudit(tx, {
        actorUserId: input.actorUserId,
        action: PAYMENT_ACTIONS.REFUND_FAILED,
        entityType: PAYMENT_AUDIT_ENTITY_TYPE,
        entityId: locked.id,
        metadata: {
          orderId: input.orderId,
          reason: input.reason ?? null,
        },
      });
    });
  }
}
