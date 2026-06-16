import { OrderStatus } from "../../../generated/prisma/client.js";

const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [
    OrderStatus.PLACED,
    OrderStatus.PAYMENT_FAILED,
  ],
  [OrderStatus.PAYMENT_FAILED]: [],
  [OrderStatus.PLACED]: [
    OrderStatus.ASSIGNED_DELIVERY_PARTNER,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.ASSIGNED_DELIVERY_PARTNER]: [
    OrderStatus.PROCESSING,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PROCESSING]: [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [
    OrderStatus.DELIVERED,
    OrderStatus.DELIVERY_FAILED,
  ],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.DELIVERY_FAILED]: [],
  [OrderStatus.CANCELLED]: [OrderStatus.REFUNDED],
  [OrderStatus.REFUNDED]: [],
};

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertOrderStatusTransition(
  from: OrderStatus,
  to: OrderStatus,
): void {
  if (!canTransitionOrderStatus(from, to)) {
    throw new Error(`Invalid order status transition: ${from} -> ${to}`);
  }
}
