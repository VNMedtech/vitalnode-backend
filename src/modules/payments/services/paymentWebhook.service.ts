/**
 * @read-only orchestrator — delegates fulfillment/refund TX to owned services
 * @idempotent: yes (WebhookEvent dedupe)
 * @external-calls: none
 */
import { env } from "../../../config/env.js";
import { logger } from "../../../infrastructure/logger/logger.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  verifyWebhookSignature,
  type RazorpayWebhookPayload,
} from "../../../infrastructure/razorpay/index.js";
import {
  UnauthorizedError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { runInTransaction } from "../../../shared/transactions/runInTransaction.js";
import { WEBHOOK_PROVIDER } from "../constants/payment.constants.js";
import { PaymentRepository } from "../repositories/payment.repository.js";
import { WebhookEventRepository } from "../repositories/webhookEvent.repository.js";
import { PaymentFulfillmentService } from "./paymentFulfillment.service.js";
import { RefundService } from "./refund.service.js";

function resolveSystemActorUserId(): string {
  const actorUserId = env.systemActorUserId;
  if (!actorUserId) {
    throw new ValidationError("System actor user is not configured");
  }
  return actorUserId;
}

export class PaymentWebhookService {
  private readonly paymentRepo = new PaymentRepository(prisma);
  private readonly fulfillmentService = new PaymentFulfillmentService();
  private readonly refundService = new RefundService();

  async processWebhook(input: {
    rawBody: string | Buffer;
    signature: string | undefined;
    eventId: string | undefined;
    payload: RazorpayWebhookPayload;
  }): Promise<{ processed: boolean; duplicate: boolean }> {
    const webhookSecret = env.razorpay.webhookSecret;
    if (!webhookSecret) {
      throw new ValidationError("Razorpay webhook secret is not configured");
    }

    if (!input.signature) {
      throw new UnauthorizedError("Missing Razorpay webhook signature");
    }

    const signatureValid = verifyWebhookSignature({
      rawBody: input.rawBody,
      signature: input.signature,
      secret: webhookSecret,
    });

    if (!signatureValid) {
      throw new UnauthorizedError("Invalid webhook signature");
    }

    const eventType = input.payload.event;
    const eventId =
      input.eventId ??
      `${eventType}:${JSON.stringify(input.payload.payload).slice(0, 128)}`;

    const webhookRepo = new WebhookEventRepository(prisma);
    const acquireResult = await webhookRepo.acquireForProcessing({
      provider: WEBHOOK_PROVIDER,
      eventId,
      eventType,
      payload: input.payload as never,
    });

    if (acquireResult.action === "skip") {
      return { processed: false, duplicate: true };
    }

    const actorUserId = resolveSystemActorUserId();

    try {
      await this.routeEvent(actorUserId, eventType, input.payload);

      await runInTransaction(async (tx) => {
        const webhookRepo = new WebhookEventRepository(tx);
        await webhookRepo.markProcessed(acquireResult.id);
      });

      logger.info(
        {
          eventId,
          eventType,
        },
        "Razorpay webhook processed",
      );

      return { processed: true, duplicate: false };
    } catch (error) {
      logger.error(
        {
          eventId,
          eventType,
          message: error instanceof Error ? error.message : "Unknown error",
        },
        "Razorpay webhook processing failed",
      );
      throw error;
    }
  }

  private async routeEvent(
    actorUserId: string,
    eventType: string,
    payload: RazorpayWebhookPayload,
  ): Promise<void> {
    switch (eventType) {
      case "payment.captured":
      case "order.paid": {
        const paymentEntity = payload.payload.payment?.entity;
        if (!paymentEntity) {
          return;
        }

        if (paymentEntity.status !== "captured") {
          return;
        }

        await this.fulfillmentService.fulfillSuccessfulPayment({
          actorUserId,
          razorpayOrderId: paymentEntity.order_id,
          razorpayPaymentId: paymentEntity.id,
          amountPaise: paymentEntity.amount,
          source: "webhook",
        });
        return;
      }

      case "payment.failed": {
        const paymentEntity = payload.payload.payment?.entity;
        if (!paymentEntity?.order_id) {
          return;
        }

        await this.fulfillmentService.markPaymentFailed({
          actorUserId,
          razorpayOrderId: paymentEntity.order_id,
          reason: "Razorpay payment.failed webhook",
        });
        return;
      }

      case "refund.processed": {
        const refundEntity = payload.payload.refund?.entity;
        if (!refundEntity) {
          return;
        }

        const payment = await this.paymentRepo.findByRazorpayPaymentId(
          refundEntity.payment_id,
        );
        if (!payment) {
          return;
        }

        await this.refundService.completeRefund({
          actorUserId,
          orderId: payment.orderId,
          razorpayPaymentId: refundEntity.payment_id,
          amountPaise: refundEntity.amount,
          source: "webhook",
        });
        return;
      }

      case "refund.failed": {
        const refundEntity = payload.payload.refund?.entity;
        if (!refundEntity) {
          return;
        }

        const payment = await this.paymentRepo.findByRazorpayPaymentId(
          refundEntity.payment_id,
        );
        if (!payment) {
          return;
        }

        await this.refundService.markRefundFailed({
          actorUserId,
          orderId: payment.orderId,
          reason: "Razorpay refund.failed webhook",
        });
        return;
      }

      default:
        return;
    }
  }
}
