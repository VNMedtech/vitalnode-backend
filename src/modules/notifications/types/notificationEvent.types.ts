import type { NOTIFICATION_EVENTS } from "../constants/notification.constants.js";

export interface InAppNotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
}

export interface SellerApprovedEvent {
  eventType: typeof NOTIFICATION_EVENTS.SELLER_APPROVED;
  correlationId: string;
  inApp: InAppNotificationPayload;
  email: {
    to: string;
    recipientName?: string;
    businessName: string;
    dashboardUrl?: string;
  };
}

export interface SellerRejectedEvent {
  eventType: typeof NOTIFICATION_EVENTS.SELLER_REJECTED;
  correlationId: string;
  inApp: InAppNotificationPayload;
  email: {
    to: string;
    recipientName?: string;
    businessName: string;
    reason?: string;
    supportUrl?: string;
  };
}

export interface ProductApprovedEvent {
  eventType: typeof NOTIFICATION_EVENTS.PRODUCT_APPROVED;
  correlationId: string;
  inApp: InAppNotificationPayload;
  email: {
    to: string;
    recipientName?: string;
    productName: string;
    marketplaceUrl?: string;
  };
}

export interface ProductRejectedEvent {
  eventType: typeof NOTIFICATION_EVENTS.PRODUCT_REJECTED;
  correlationId: string;
  inApp: InAppNotificationPayload;
  email: {
    to: string;
    recipientName?: string;
    productName: string;
    reason?: string;
    supportUrl?: string;
  };
}

export interface OrderPlacedEvent {
  eventType: typeof NOTIFICATION_EVENTS.ORDER_PLACED;
  correlationId: string;
  inApp: InAppNotificationPayload[];
  emails: Array<{
    to: string;
    recipientName?: string;
    orderNumber: string;
    totalAmount: string;
    orderUrl?: string;
    role: "BUYER" | "SELLER";
  }>;
}

export interface OrderCancelledEvent {
  eventType: typeof NOTIFICATION_EVENTS.ORDER_CANCELLED;
  correlationId: string;
  inApp: InAppNotificationPayload[];
  emails: Array<{
    to: string;
    recipientName?: string;
    orderNumber: string;
    reason?: string;
    orderUrl?: string;
    role: "BUYER" | "SELLER";
  }>;
}

export interface DeliveryAssignedEvent {
  eventType: typeof NOTIFICATION_EVENTS.DELIVERY_ASSIGNED;
  correlationId: string;
  inApp: InAppNotificationPayload[];
  emails: Array<{
    to: string;
    recipientName?: string;
    orderNumber: string;
    deliveryUrl?: string;
    role: "DELIVERY_PARTNER" | "BUYER" | "SELLER";
  }>;
}

export interface OrderDeliveredEvent {
  eventType: typeof NOTIFICATION_EVENTS.ORDER_DELIVERED;
  correlationId: string;
  inApp: InAppNotificationPayload[];
  emails: Array<{
    to: string;
    recipientName?: string;
    orderNumber: string;
    orderUrl?: string;
    role: "BUYER" | "SELLER";
  }>;
}

export type NotificationEvent =
  | SellerApprovedEvent
  | SellerRejectedEvent
  | ProductApprovedEvent
  | ProductRejectedEvent
  | OrderPlacedEvent
  | OrderCancelledEvent
  | DeliveryAssignedEvent
  | OrderDeliveredEvent;
