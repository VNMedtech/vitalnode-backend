import { PaymentStatus } from "../../../generated/prisma/client.js";

const ALLOWED_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [PaymentStatus.SUCCESS, PaymentStatus.FAILED],
  [PaymentStatus.SUCCESS]: [],
  [PaymentStatus.FAILED]: [],
};

export function canTransitionPaymentStatus(
  from: PaymentStatus,
  to: PaymentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertPaymentStatusTransition(
  from: PaymentStatus,
  to: PaymentStatus,
): void {
  if (!canTransitionPaymentStatus(from, to)) {
    throw new Error(`Invalid payment status transition: ${from} -> ${to}`);
  }
}
