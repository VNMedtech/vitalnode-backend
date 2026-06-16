import { OrderStatus, PaymentStatus, RefundStatus } from "../../../generated/prisma/client.js";
import { describe, expect, it } from "vitest";
import {
  assertOrderStatusTransition,
  canTransitionOrderStatus,
} from "../../../src/shared/stateMachine/orderStatus.guard.js";
import {
  assertPaymentStatusTransition,
  canTransitionPaymentStatus,
} from "../../../src/shared/stateMachine/paymentStatus.guard.js";
import {
  assertRefundStatusTransition,
  canTransitionRefundStatus,
} from "../../../src/shared/stateMachine/refundStatus.guard.js";

function testTransitionMatrix<T extends string>(
  label: string,
  allStates: readonly T[],
  canTransition: (from: T, to: T) => boolean,
  assertTransition: (from: T, to: T) => void,
  allowedMap: Record<T, readonly T[]>,
) {
  describe(label, () => {
    describe("valid transitions", () => {
      for (const from of allStates) {
        for (const to of allowedMap[from]) {
          it(`allows ${from} -> ${to}`, () => {
            expect(canTransition(from, to)).toBe(true);
            expect(() => assertTransition(from, to)).not.toThrow();
          });
        }
      }
    });

    describe("invalid transitions", () => {
      for (const from of allStates) {
        const invalidTargets = allStates.filter(
          (to) => to !== from && !allowedMap[from].includes(to),
        );

        for (const to of invalidTargets) {
          it(`rejects ${from} -> ${to}`, () => {
            expect(canTransition(from, to)).toBe(false);
            expect(() => assertTransition(from, to)).toThrow();
          });
        }
      }
    });
  });
}

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
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

const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [PaymentStatus.SUCCESS, PaymentStatus.FAILED],
  [PaymentStatus.SUCCESS]: [],
  [PaymentStatus.FAILED]: [],
};

const REFUND_TRANSITIONS: Record<RefundStatus, readonly RefundStatus[]> = {
  [RefundStatus.NOT_APPLICABLE]: [RefundStatus.PENDING],
  [RefundStatus.PENDING]: [RefundStatus.SUCCESS, RefundStatus.FAILED],
  [RefundStatus.SUCCESS]: [],
  [RefundStatus.FAILED]: [RefundStatus.PENDING],
};

describe("Commerce status guards", () => {
  testTransitionMatrix(
    "Order status",
    Object.values(OrderStatus),
    canTransitionOrderStatus,
    assertOrderStatusTransition,
    ORDER_TRANSITIONS,
  );

  testTransitionMatrix(
    "Payment status",
    Object.values(PaymentStatus),
    canTransitionPaymentStatus,
    assertPaymentStatusTransition,
    PAYMENT_TRANSITIONS,
  );

  testTransitionMatrix(
    "Refund status",
    Object.values(RefundStatus),
    canTransitionRefundStatus,
    assertRefundStatusTransition,
    REFUND_TRANSITIONS,
  );
});
