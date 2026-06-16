import type { EMAIL_TEMPLATE_IDS } from "../constants/email.constants.js";

export type EmailTemplateId =
  (typeof EMAIL_TEMPLATE_IDS)[keyof typeof EMAIL_TEMPLATE_IDS];

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface PasswordResetEmailData {
  recipientName?: string;
  resetLink?: string;
  resetToken?: string;
  expiresInMinutes: number;
}

export interface SellerApprovedEmailData {
  recipientName?: string;
  businessName: string;
  dashboardUrl?: string;
}

export interface SellerRejectedEmailData {
  recipientName?: string;
  businessName: string;
  reason?: string;
  supportUrl?: string;
}

export interface ProductApprovedEmailData {
  recipientName?: string;
  productName: string;
  marketplaceUrl?: string;
}

export interface ProductRejectedEmailData {
  recipientName?: string;
  productName: string;
  reason?: string;
  supportUrl?: string;
}

export interface OrderPlacedEmailData {
  recipientName?: string;
  orderNumber: string;
  totalAmount: string;
  orderUrl?: string;
  role: "BUYER" | "SELLER";
}

export interface OrderCancelledEmailData {
  recipientName?: string;
  orderNumber: string;
  reason?: string;
  orderUrl?: string;
  role: "BUYER" | "SELLER";
}

export interface DeliveryAssignedEmailData {
  recipientName?: string;
  orderNumber: string;
  deliveryUrl?: string;
  role: "DELIVERY_PARTNER" | "BUYER" | "SELLER";
}

export interface OrderDeliveredEmailData {
  recipientName?: string;
  orderNumber: string;
  orderUrl?: string;
  role: "BUYER" | "SELLER";
}

export type TemplateDataMap = {
  [EMAIL_TEMPLATE_IDS.PASSWORD_RESET]: PasswordResetEmailData;
  [EMAIL_TEMPLATE_IDS.SELLER_APPROVED]: SellerApprovedEmailData;
  [EMAIL_TEMPLATE_IDS.SELLER_REJECTED]: SellerRejectedEmailData;
  [EMAIL_TEMPLATE_IDS.PRODUCT_APPROVED]: ProductApprovedEmailData;
  [EMAIL_TEMPLATE_IDS.PRODUCT_REJECTED]: ProductRejectedEmailData;
  [EMAIL_TEMPLATE_IDS.ORDER_PLACED]: OrderPlacedEmailData;
  [EMAIL_TEMPLATE_IDS.ORDER_CANCELLED]: OrderCancelledEmailData;
  [EMAIL_TEMPLATE_IDS.DELIVERY_ASSIGNED]: DeliveryAssignedEmailData;
  [EMAIL_TEMPLATE_IDS.ORDER_DELIVERED]: OrderDeliveredEmailData;
};
