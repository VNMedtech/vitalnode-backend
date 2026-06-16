export const EMAIL_TEMPLATE_IDS = {
  PASSWORD_RESET: "password-reset",
  SELLER_APPROVED: "seller-approved",
  SELLER_REJECTED: "seller-rejected",
  PRODUCT_APPROVED: "product-approved",
  PRODUCT_REJECTED: "product-rejected",
  ORDER_PLACED: "order-placed",
  ORDER_CANCELLED: "order-cancelled",
  DELIVERY_ASSIGNED: "delivery-assigned",
  ORDER_DELIVERED: "order-delivered",
} as const;

export const EMAIL_SUBJECTS = {
  PASSWORD_RESET: "Reset your password",
  SELLER_APPROVED: "Your seller account has been approved",
  SELLER_REJECTED: "Your seller application was not approved",
  PRODUCT_APPROVED: "Your product has been approved",
  PRODUCT_REJECTED: "Your product was not approved",
  ORDER_PLACED: "Order placed successfully",
  ORDER_CANCELLED: "Order cancelled",
  DELIVERY_ASSIGNED: "Delivery partner assigned",
  ORDER_DELIVERED: "Order delivered",
} as const;

export const EMAIL_BRAND = {
  name: "Medical Equipment Marketplace",
  supportEmail: "support@marketplace.local",
} as const;
