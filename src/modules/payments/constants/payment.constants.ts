export const PAYMENT_ROUTES = {
  CREATE_ORDER: "POST:/api/v1/payments/create-order",
  VERIFY: "POST:/api/v1/payments/verify",
  REFUND: "POST:/api/v1/payments/refund",
} as const;

export const PAYMENT_AUDIT_ENTITY_TYPE = "PAYMENT";
export const ORDER_AUDIT_ENTITY_TYPE = "ORDER";

export const PAYMENT_ACTIONS = {
  ORDER_CREATED: "PAYMENT_RAZORPAY_ORDER_CREATED",
  SUCCESS: "PAYMENT_SUCCESS",
  FAILED: "PAYMENT_FAILED",
  FULFILLMENT_COMPENSATION: "PAYMENT_FULFILLMENT_COMPENSATION",
  REFUND_INITIATED: "REFUND_INITIATED",
  REFUND_SUCCESS: "REFUND_SUCCESS",
  REFUND_FAILED: "REFUND_FAILED",
} as const;

/** Thrown when Razorpay captured funds but internal fulfillment could not complete. */
export const INSUFFICIENT_INVENTORY_FULFILLMENT_MESSAGE =
  "Insufficient inventory to fulfill order";

export const ORDER_ACTIONS = {
  PLACED: "ORDER_PLACED",
  REFUNDED: "ORDER_REFUNDED",
} as const;

export const INVENTORY_ACTIONS = {
  DEDUCTED: "INVENTORY_DEDUCTED",
} as const;

export const INVENTORY_AUDIT_ENTITY_TYPE = "INVENTORY";

export const WEBHOOK_PROVIDER = "RAZORPAY";

/** Placeholder prefix set at checkout before Razorpay order is created. */
export const PENDING_RAZORPAY_ORDER_PREFIX = "pending_";

export const RAZORPAY_CURRENCY = "INR";
