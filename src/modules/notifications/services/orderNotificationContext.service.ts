import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  buildAppUrl,
  buildRecipientName,
} from "../../email/services/email.service.js";
import { NOTIFICATION_EVENTS, NOTIFICATION_TYPES } from "../constants/notification.constants.js";
import type {
  DeliveryAssignedEvent,
  OrderCancelledEvent,
  OrderDeliveredEvent,
  OrderPlacedEvent,
} from "../types/notificationEvent.types.js";

const orderPartySelect = {
  id: true,
  orderNumber: true,
  totalAmount: true,
  buyer: {
    select: {
      userId: true,
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  seller: {
    select: {
      userId: true,
      businessName: true,
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  deliveryPartner: {
    select: {
      userId: true,
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
} as const;

export class OrderNotificationContextService {
  async buildOrderPlacedEvent(orderId: string): Promise<OrderPlacedEvent | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: orderPartySelect,
    });

    if (!order) {
      return null;
    }

    const totalAmount = order.totalAmount.toString();
    const buyerUser = order.buyer.user;
    const sellerUser = order.seller.user;

    return {
      eventType: NOTIFICATION_EVENTS.ORDER_PLACED,
      correlationId: orderId,
      inApp: [
        {
          userId: order.buyer.userId,
          type: NOTIFICATION_TYPES.ORDER_PLACED,
          title: "Order placed",
          message: `Your order ${order.orderNumber} has been placed successfully.`,
        },
        {
          userId: order.seller.userId,
          type: NOTIFICATION_TYPES.ORDER_PLACED,
          title: "New order received",
          message: `You have received order ${order.orderNumber} for ₹${totalAmount}.`,
        },
      ],
      emails: [
        {
          to: buyerUser.email,
          recipientName: buildRecipientName(
            buyerUser.firstName,
            buyerUser.lastName,
          ),
          orderNumber: order.orderNumber,
          totalAmount,
          orderUrl: buildAppUrl(`/orders/${orderId}`),
          role: "BUYER",
        },
        {
          to: sellerUser.email,
          recipientName: buildRecipientName(
            sellerUser.firstName,
            sellerUser.lastName,
          ),
          orderNumber: order.orderNumber,
          totalAmount,
          orderUrl: buildAppUrl(`/seller/orders/${orderId}`),
          role: "SELLER",
        },
      ],
    };
  }

  async buildOrderCancelledEvent(
    orderId: string,
    reason?: string,
  ): Promise<OrderCancelledEvent | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: orderPartySelect,
    });

    if (!order) {
      return null;
    }

    const reasonSuffix = reason ? ` Reason: ${reason}` : "";

    return {
      eventType: NOTIFICATION_EVENTS.ORDER_CANCELLED,
      correlationId: orderId,
      inApp: [
        {
          userId: order.buyer.userId,
          type: NOTIFICATION_TYPES.ORDER_CANCELLED,
          title: "Order cancelled",
          message: `Your order ${order.orderNumber} has been cancelled.${reasonSuffix}`,
        },
        {
          userId: order.seller.userId,
          type: NOTIFICATION_TYPES.ORDER_CANCELLED,
          title: "Order cancelled",
          message: `Order ${order.orderNumber} has been cancelled.${reasonSuffix}`,
        },
      ],
      emails: [
        {
          to: order.buyer.user.email,
          recipientName: buildRecipientName(
            order.buyer.user.firstName,
            order.buyer.user.lastName,
          ),
          orderNumber: order.orderNumber,
          reason,
          orderUrl: buildAppUrl(`/orders/${orderId}`),
          role: "BUYER",
        },
        {
          to: order.seller.user.email,
          recipientName: buildRecipientName(
            order.seller.user.firstName,
            order.seller.user.lastName,
          ),
          orderNumber: order.orderNumber,
          reason,
          orderUrl: buildAppUrl(`/seller/orders/${orderId}`),
          role: "SELLER",
        },
      ],
    };
  }

  async buildDeliveryAssignedEvent(
    orderId: string,
    deliveryPartnerId: string,
  ): Promise<DeliveryAssignedEvent | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: orderPartySelect,
    });

    if (!order) {
      return null;
    }

    const partner = await prisma.deliveryPartnerProfile.findUnique({
      where: { id: deliveryPartnerId },
      select: {
        userId: true,
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!partner) {
      return null;
    }

    const inApp = [
      {
        userId: partner.userId,
        type: NOTIFICATION_TYPES.DELIVERY_ASSIGNED,
        title: "Delivery assigned",
        message: `You have been assigned to deliver order ${order.orderNumber}.`,
      },
      {
        userId: order.buyer.userId,
        type: NOTIFICATION_TYPES.DELIVERY_ASSIGNED,
        title: "Delivery partner assigned",
        message: `A delivery partner has been assigned to your order ${order.orderNumber}.`,
      },
      {
        userId: order.seller.userId,
        type: NOTIFICATION_TYPES.DELIVERY_ASSIGNED,
        title: "Delivery partner assigned",
        message: `A delivery partner has been assigned to order ${order.orderNumber}.`,
      },
    ];

    const emails = [
      {
        to: partner.user.email,
        recipientName: buildRecipientName(
          partner.user.firstName,
          partner.user.lastName,
        ),
        orderNumber: order.orderNumber,
        deliveryUrl: buildAppUrl(`/delivery/orders/${orderId}`),
        role: "DELIVERY_PARTNER" as const,
      },
      {
        to: order.buyer.user.email,
        recipientName: buildRecipientName(
          order.buyer.user.firstName,
          order.buyer.user.lastName,
        ),
        orderNumber: order.orderNumber,
        deliveryUrl: buildAppUrl(`/orders/${orderId}`),
        role: "BUYER" as const,
      },
      {
        to: order.seller.user.email,
        recipientName: buildRecipientName(
          order.seller.user.firstName,
          order.seller.user.lastName,
        ),
        orderNumber: order.orderNumber,
        deliveryUrl: buildAppUrl(`/seller/orders/${orderId}`),
        role: "SELLER" as const,
      },
    ];

    return {
      eventType: NOTIFICATION_EVENTS.DELIVERY_ASSIGNED,
      correlationId: orderId,
      inApp,
      emails,
    };
  }

  async buildOrderDeliveredEvent(
    orderId: string,
  ): Promise<OrderDeliveredEvent | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: orderPartySelect,
    });

    if (!order) {
      return null;
    }

    return {
      eventType: NOTIFICATION_EVENTS.ORDER_DELIVERED,
      correlationId: orderId,
      inApp: [
        {
          userId: order.buyer.userId,
          type: NOTIFICATION_TYPES.ORDER_DELIVERED,
          title: "Order delivered",
          message: `Your order ${order.orderNumber} has been delivered.`,
        },
        {
          userId: order.seller.userId,
          type: NOTIFICATION_TYPES.ORDER_DELIVERED,
          title: "Order delivered",
          message: `Order ${order.orderNumber} has been marked as delivered.`,
        },
      ],
      emails: [
        {
          to: order.buyer.user.email,
          recipientName: buildRecipientName(
            order.buyer.user.firstName,
            order.buyer.user.lastName,
          ),
          orderNumber: order.orderNumber,
          orderUrl: buildAppUrl(`/orders/${orderId}`),
          role: "BUYER",
        },
        {
          to: order.seller.user.email,
          recipientName: buildRecipientName(
            order.seller.user.firstName,
            order.seller.user.lastName,
          ),
          orderNumber: order.orderNumber,
          orderUrl: buildAppUrl(`/seller/orders/${orderId}`),
          role: "SELLER",
        },
      ],
    };
  }
}

export const orderNotificationContextService =
  new OrderNotificationContextService();
