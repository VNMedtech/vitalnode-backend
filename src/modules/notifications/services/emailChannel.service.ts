import { logger } from "../../../infrastructure/logger/logger.js";
import { emailService } from "../../email/services/email.service.js";
import type { NotificationEvent } from "../types/notificationEvent.types.js";
import { withRetry } from "../utils/retry.util.js";

export class EmailChannelService {
  async handleEvent(event: NotificationEvent): Promise<void> {
    if (!emailService.isConfigured()) {
      logger.warn(
        {
          eventType: event.eventType,
          correlationId: event.correlationId,
        },
        "Email channel skipped — SES not configured",
      );
      return;
    }

    switch (event.eventType) {
      case "SELLER_APPROVED":
        await withRetry(
          () =>
            emailService.sendSellerApprovedEmail(event.email.to, {
              recipientName: event.email.recipientName,
              businessName: event.email.businessName,
              dashboardUrl: event.email.dashboardUrl,
            }),
          {
            operation: "email.seller_approved",
            context: {
              eventType: event.eventType,
              correlationId: event.correlationId,
              to: event.email.to,
            },
          },
        );
        return;

      case "SELLER_REJECTED":
        await withRetry(
          () =>
            emailService.sendSellerRejectedEmail(event.email.to, {
              recipientName: event.email.recipientName,
              businessName: event.email.businessName,
              reason: event.email.reason,
              supportUrl: event.email.supportUrl,
            }),
          {
            operation: "email.seller_rejected",
            context: {
              eventType: event.eventType,
              correlationId: event.correlationId,
              to: event.email.to,
            },
          },
        );
        return;

      case "PRODUCT_APPROVED":
        await withRetry(
          () =>
            emailService.sendProductApprovedEmail(event.email.to, {
              recipientName: event.email.recipientName,
              productName: event.email.productName,
              marketplaceUrl: event.email.marketplaceUrl,
            }),
          {
            operation: "email.product_approved",
            context: {
              eventType: event.eventType,
              correlationId: event.correlationId,
              to: event.email.to,
            },
          },
        );
        return;

      case "PRODUCT_REJECTED":
        await withRetry(
          () =>
            emailService.sendProductRejectedEmail(event.email.to, {
              recipientName: event.email.recipientName,
              productName: event.email.productName,
              reason: event.email.reason,
              supportUrl: event.email.supportUrl,
            }),
          {
            operation: "email.product_rejected",
            context: {
              eventType: event.eventType,
              correlationId: event.correlationId,
              to: event.email.to,
            },
          },
        );
        return;

      case "ORDER_PLACED":
        await Promise.all(
          event.emails.map((email) =>
            withRetry(
              () =>
                emailService.sendOrderPlacedEmail(email.to, {
                  recipientName: email.recipientName,
                  orderNumber: email.orderNumber,
                  totalAmount: email.totalAmount,
                  orderUrl: email.orderUrl,
                  role: email.role,
                }),
              {
                operation: "email.order_placed",
                context: {
                  eventType: event.eventType,
                  correlationId: event.correlationId,
                  to: email.to,
                  role: email.role,
                },
              },
            ),
          ),
        );
        return;

      case "ORDER_CANCELLED":
        await Promise.all(
          event.emails.map((email) =>
            withRetry(
              () =>
                emailService.sendOrderCancelledEmail(email.to, {
                  recipientName: email.recipientName,
                  orderNumber: email.orderNumber,
                  reason: email.reason,
                  orderUrl: email.orderUrl,
                  role: email.role,
                }),
              {
                operation: "email.order_cancelled",
                context: {
                  eventType: event.eventType,
                  correlationId: event.correlationId,
                  to: email.to,
                  role: email.role,
                },
              },
            ),
          ),
        );
        return;

      case "DELIVERY_ASSIGNED":
        await Promise.all(
          event.emails.map((email) =>
            withRetry(
              () =>
                emailService.sendDeliveryAssignedEmail(email.to, {
                  recipientName: email.recipientName,
                  orderNumber: email.orderNumber,
                  deliveryUrl: email.deliveryUrl,
                  role: email.role,
                }),
              {
                operation: "email.delivery_assigned",
                context: {
                  eventType: event.eventType,
                  correlationId: event.correlationId,
                  to: email.to,
                  role: email.role,
                },
              },
            ),
          ),
        );
        return;

      case "ORDER_DELIVERED":
        await Promise.all(
          event.emails.map((email) =>
            withRetry(
              () =>
                emailService.sendOrderDeliveredEmail(email.to, {
                  recipientName: email.recipientName,
                  orderNumber: email.orderNumber,
                  orderUrl: email.orderUrl,
                  role: email.role,
                }),
              {
                operation: "email.order_delivered",
                context: {
                  eventType: event.eventType,
                  correlationId: event.correlationId,
                  to: email.to,
                  role: email.role,
                },
              },
            ),
          ),
        );
        return;

      case "SETTLEMENT_BATCH_CREATED":
      case "SETTLEMENT_BATCH_DISBURSED":
        return;

      default: {
        const exhaustiveCheck: never = event;
        logger.error(
          { event: exhaustiveCheck },
          "Unsupported notification event for email channel",
        );
      }
    }
  }
}

export const emailChannelService = new EmailChannelService();
