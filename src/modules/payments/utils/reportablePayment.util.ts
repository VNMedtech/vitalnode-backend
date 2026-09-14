import {
  Prisma,
  RefundStatus,
  type PaymentStatus,
} from "../../../../generated/prisma/client.js";

/**
 * Reportable paid volume: successful captures that have not been fully refunded.
 * `paymentStatus` stays SUCCESS after refund; only `refundStatus` flips.
 */
export const reportablePaidPaymentWhere: Prisma.PaymentWhereInput = {
  paymentStatus: "SUCCESS" as PaymentStatus,
  refundStatus: { not: RefundStatus.SUCCESS },
};

/** Raw SQL predicate for Payment alias `pay`. */
export const reportablePaidPaymentSqlPay = Prisma.sql`
  pay."paymentStatus" = 'SUCCESS'::"PaymentStatus"
  AND pay."refundStatus" <> 'SUCCESS'::"RefundStatus"
`;

/** Raw SQL predicate for Payment alias `p`. */
export const reportablePaidPaymentSqlP = Prisma.sql`
  p."paymentStatus" = 'SUCCESS'::"PaymentStatus"
  AND p."refundStatus" <> 'SUCCESS'::"RefundStatus"
`;
