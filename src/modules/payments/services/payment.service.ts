/**
 * @transaction-owner (razorpay order id update only)
 * @idempotent: yes
 * @external-calls: Razorpay orders.create
 */
import { OrderStatus, PaymentStatus } from "../../../../generated/prisma/client.js";
import { env } from "../../../config/env.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  razorpayClient,
  verifyPaymentSignature,
} from "../../../infrastructure/razorpay/index.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { withIdempotency } from "../../../shared/idempotency/withIdempotency.js";
import { runInTransaction } from "../../../shared/transactions/runInTransaction.js";
import { recordCommerceAudit } from "../../auditLogs/services/commerceAudit.service.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { BuyerRepository } from "../../buyers/repositories/buyer.repository.js";
import { OrderRepository } from "../../orders/repositories/order.repository.js";
import { SellerRepository } from "../../sellers/repositories/seller.repository.js";
import {
  PAYMENT_ACTIONS,
  PAYMENT_AUDIT_ENTITY_TYPE,
  PAYMENT_ROUTES,
  PENDING_RAZORPAY_ORDER_PREFIX,
  RAZORPAY_CURRENCY,
} from "../constants/payment.constants.js";
import {
  toCreatePaymentOrderDto,
  toPaymentDetailsDto,
  toVerifyPaymentDto,
} from "../dto/payment.dto.js";
import { PaymentRepository } from "../repositories/payment.repository.js";
import { decimalToPaise } from "../utils/money.util.js";
import type {
  CreatePaymentOrderInput,
  VerifyPaymentInput,
} from "../types/payment.types.js";
import { PaymentFulfillmentService } from "./paymentFulfillment.service.js";

function isPendingRazorpayOrderId(razorpayOrderId: string): boolean {
  return razorpayOrderId.startsWith(PENDING_RAZORPAY_ORDER_PREFIX);
}

export class PaymentService {
  private readonly paymentRepo = new PaymentRepository(prisma);
  private readonly orderRepo = new OrderRepository(prisma);
  private readonly buyerRepo = new BuyerRepository(prisma);
  private readonly sellerRepo = new SellerRepository(prisma);
  private readonly fulfillmentService = new PaymentFulfillmentService();

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

  async getPaymentDetails(
    actorUserId: string,
    role: UserRole,
    orderId: string,
  ) {
    let order;

    switch (role) {
      case UserRole.BUYER: {
        const buyerId = await this.resolveBuyerId(actorUserId);
        order = await this.orderRepo.findDetailByIdForBuyer(orderId, buyerId);
        break;
      }
      case UserRole.SELLER: {
        const sellerId = await this.resolveSellerId(actorUserId);
        order = await this.orderRepo.findDetailByIdForSeller(orderId, sellerId);
        break;
      }
      case UserRole.ADMIN:
        order = await this.orderRepo.findDetailById(orderId);
        break;
      default:
        throw new ForbiddenError("Access denied");
    }

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    const payment = await this.paymentRepo.findByOrderId(orderId);
    if (!payment) {
      throw new NotFoundError("Payment not found for order");
    }

    return toPaymentDetailsDto({
      payment,
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      currency: RAZORPAY_CURRENCY,
    });
  }

  async createRazorpayOrder(
    actorUserId: string,
    input: CreatePaymentOrderInput,
    idempotencyKey?: string,
  ) {
    const execute = async () => {
      const buyerId = await this.resolveBuyerId(actorUserId);
      const order = await this.orderRepo.findByIdForBuyer(input.orderId, buyerId);

      if (!order) {
        throw new NotFoundError("Order not found");
      }

      if (order.orderStatus !== OrderStatus.PENDING_PAYMENT) {
        throw new ConflictError("Order is not awaiting payment");
      }

      if (!order.payment) {
        throw new NotFoundError("Payment record not found for order");
      }

      if (order.payment.paymentStatus !== PaymentStatus.PENDING) {
        throw new ConflictError("Payment is not pending");
      }

      if (!isPendingRazorpayOrderId(order.payment.razorpayOrderId)) {
        return toCreatePaymentOrderDto({
          orderId: order.id,
          orderNumber: order.orderNumber,
          razorpayOrderId: order.payment.razorpayOrderId,
          razorpayKeyId: razorpayClient.getKeyId(),
          amount: order.payment.amount.toString(),
          currency: RAZORPAY_CURRENCY,
        });
      }

      const payment = order.payment;
      const razorpayOrder = await razorpayClient.createOrder({
        amountPaise: decimalToPaise(payment.amount),
        currency: RAZORPAY_CURRENCY,
        receipt: order.id,
        notes: {
          orderNumber: order.orderNumber,
        },
      });

      const updated = await runInTransaction(async (tx) => {
        const paymentRepo = new PaymentRepository(tx);
        const result = await paymentRepo.updateRazorpayOrderId(
          payment.id,
          razorpayOrder.id,
        );

        await recordCommerceAudit(tx, {
          actorUserId,
          action: PAYMENT_ACTIONS.ORDER_CREATED,
          entityType: PAYMENT_AUDIT_ENTITY_TYPE,
          entityId: result.id,
          metadata: {
            orderId: order.id,
            razorpayOrderId: razorpayOrder.id,
            amount: payment.amount.toString(),
          },
        });

        return result;
      });

      return toCreatePaymentOrderDto({
        orderId: order.id,
        orderNumber: order.orderNumber,
        razorpayOrderId: razorpayOrder.id,
        razorpayKeyId: razorpayClient.getKeyId(),
        amount: payment.amount.toString(),
        currency: RAZORPAY_CURRENCY,
      });
    };

    if (!idempotencyKey) {
      return execute();
    }

    return withIdempotency({
      actorUserId,
      key: idempotencyKey,
      route: PAYMENT_ROUTES.CREATE_ORDER,
      requestHash: input.orderId,
      handler: execute,
    });
  }

  async verifyPayment(
    actorUserId: string,
    input: VerifyPaymentInput,
    idempotencyKey?: string,
  ) {
    const execute = async () => {
      await this.resolveBuyerId(actorUserId);

      const secret = env.razorpay.keySecret;
      if (!secret) {
        throw new ValidationError("Razorpay is not configured");
      }

      const signatureValid = verifyPaymentSignature({
        orderId: input.razorpayOrderId,
        paymentId: input.razorpayPaymentId,
        signature: input.razorpaySignature,
        secret,
      });

      if (!signatureValid) {
        throw new UnauthorizedError("Invalid payment signature");
      }

      const payment = await this.paymentRepo.findByRazorpayOrderId(
        input.razorpayOrderId,
      );
      if (!payment) {
        throw new NotFoundError("Payment not found");
      }

      const buyerId = await this.resolveBuyerId(actorUserId);
      if (payment.order.buyerId !== buyerId) {
        throw new ForbiddenError("Payment does not belong to this buyer");
      }

      const fulfillment = await this.fulfillmentService.fulfillSuccessfulPayment({
        actorUserId,
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        amountPaise: decimalToPaise(payment.amount),
        source: "verify",
      });

      return toVerifyPaymentDto({
        orderId: fulfillment.orderId,
        orderNumber: fulfillment.orderNumber,
        orderStatus: fulfillment.orderStatus,
        paymentStatus: fulfillment.paymentStatus,
        alreadyFulfilled: fulfillment.alreadyFulfilled,
      });
    };

    if (!idempotencyKey) {
      return execute();
    }

    return withIdempotency({
      actorUserId,
      key: idempotencyKey,
      route: PAYMENT_ROUTES.VERIFY,
      requestHash: `${input.razorpayOrderId}:${input.razorpayPaymentId}`,
      handler: execute,
    });
  }
}
