export const ORDER_ROUTES = {
  CHECKOUT: "POST:/api/v1/orders/checkout",
  CANCEL: "POST:/api/v1/orders/cancel",
  ADMIN_CANCEL: "POST:/api/v1/orders/:id/cancel",
} as const;

export const ORDER_AUDIT_ENTITY_TYPE = "ORDER" as const;

export const ORDER_ACTIONS = {
  CHECKOUT_INITIATED: "ORDER_CHECKOUT_INITIATED",
  CANCELLED: "ORDER_CANCELLED",
  STATUS_CHANGED: "ORDER_STATUS_CHANGED",
  FULFILLMENT_METHOD_SET: "ORDER_FULFILLMENT_METHOD_SET",
  FULFILLMENT_METHOD_CHANGED: "ORDER_FULFILLMENT_METHOD_CHANGED",
  TRACKING_UPDATED: "ORDER_TRACKING_UPDATED",
  DELIVERY_PARTNER_ASSIGNED: "DELIVERY_PARTNER_ASSIGNED",
  DELIVERY_PARTNER_REASSIGNED: "DELIVERY_PARTNER_REASSIGNED",
  HANDOVER_PROOF_UPLOADED: "ORDER_HANDOVER_PROOF_UPLOADED",
  DELIVERY_PROOF_UPLOADED: "ORDER_DELIVERY_PROOF_UPLOADED",
} as const;

export const ORDER_DEFAULT_PAGE = 1;
export const ORDER_DEFAULT_LIMIT = 20;
export const ORDER_MAX_LIMIT = 100;

export const ORDER_SORT_FIELDS = ["createdAt", "placedAt", "totalAmount"] as const;
export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

export const CANCELLABLE_ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PLACED",
  "CONFIRMED",
] as const;

export const ORDER_NUMBER_PREFIX = "ORD";
export const ORDER_CANCEL_REASON_MAX_LENGTH = 500;
export const ORDER_PROOF_URL_MAX_LENGTH = 2048;
export const ORDER_DELIVERY_FAIL_REASON_MAX_LENGTH = 500;

/**
 * Terminal statuses for a delivery partner assignment (aligns with portal
 * `INACTIVE_ASSIGNMENT_STATUSES`). Assigned orders outside this set count as ongoing.
 */
export const DELIVERY_PARTNER_INACTIVE_ASSIGNMENT_STATUSES = [
  "PENDING_SETTLEMENT",
  "DELIVERED",
  "SETTLED",
  "DELIVERY_FAILED",
  "CANCELLED",
  "REFUNDED",
] as const;

/** Successful delivery outcomes for partner dashboard stats. */
export const DELIVERY_PARTNER_COMPLETED_STATUSES = [
  "DELIVERED",
  "PENDING_SETTLEMENT",
  "SETTLED",
] as const;

/** Failed drop-offs for partner dashboard stats. */
export const DELIVERY_PARTNER_FAILED_STATUSES = ["DELIVERY_FAILED"] as const;
