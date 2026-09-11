import { RefundStatus } from "../../../generated/prisma/client.js";
import { ConflictError } from "../errors/app.errors.js";

const ALLOWED_TRANSITIONS: Record<RefundStatus, readonly RefundStatus[]> = {
  [RefundStatus.NOT_APPLICABLE]: [RefundStatus.PENDING],
  [RefundStatus.PENDING]: [RefundStatus.SUCCESS, RefundStatus.FAILED],
  [RefundStatus.SUCCESS]: [],
  [RefundStatus.FAILED]: [RefundStatus.PENDING],
};

export function canTransitionRefundStatus(
  from: RefundStatus,
  to: RefundStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertRefundStatusTransition(
  from: RefundStatus,
  to: RefundStatus,
): void {
  if (!canTransitionRefundStatus(from, to)) {
    throw new ConflictError(
      `Invalid refund status transition: ${from} -> ${to}`,
    );
  }
}
