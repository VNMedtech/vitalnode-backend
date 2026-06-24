import { OrderStatus } from "../../../generated/prisma/client.js";

/** Orders that have completed delivery and may be eligible for settlement. */
export const PENDING_SETTLEMENT_ORDER_STATUS = OrderStatus.PENDING_SETTLEMENT;

/** Orders that have been paid out to the seller. */
export const SETTLED_ORDER_STATUS = OrderStatus.SETTLED;

/** Statuses representing a successfully delivered order (for reporting and reviews). */
export const POST_DELIVERY_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.PENDING_SETTLEMENT,
  OrderStatus.SETTLED,
];

export function isPostDeliveryOrderStatus(status: OrderStatus): boolean {
  return POST_DELIVERY_ORDER_STATUSES.includes(status);
}
