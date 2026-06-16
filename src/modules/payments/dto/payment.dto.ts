import type {
  OrderStatus,
  PaymentStatus,
  RefundStatus,
} from "../../../../generated/prisma/client.js";

/** API-facing lifecycle label (maps SUCCESS → PAID per product docs). */
export type PaymentLifecycleStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED";

export interface CreatePaymentOrderDto {
  orderId: string;
  orderNumber: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amount: string;
  currency: string;
}

export interface VerifyPaymentDto {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  alreadyFulfilled: boolean;
}

export interface RefundPaymentDto {
  orderId: string;
  orderStatus: OrderStatus;
  refundStatus: string;
  alreadyCompleted: boolean;
}

export interface PaymentDetailsDto {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amount: string;
  currency: string;
  paymentStatus: PaymentStatus;
  refundStatus: RefundStatus;
  lifecycleStatus: PaymentLifecycleStatus;
  createdAt: string;
  updatedAt: string;
}

export function resolvePaymentLifecycleStatus(input: {
  paymentStatus: PaymentStatus;
  refundStatus: RefundStatus;
  orderStatus: OrderStatus;
}): PaymentLifecycleStatus {
  if (
    input.refundStatus === "SUCCESS" ||
    input.orderStatus === "REFUNDED"
  ) {
    return "REFUNDED";
  }

  if (input.paymentStatus === "SUCCESS") {
    return "PAID";
  }

  if (input.paymentStatus === "FAILED") {
    return "FAILED";
  }

  return "PENDING";
}

export function toCreatePaymentOrderDto(input: {
  orderId: string;
  orderNumber: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amount: string;
  currency: string;
}): CreatePaymentOrderDto {
  return {
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    razorpayOrderId: input.razorpayOrderId,
    razorpayKeyId: input.razorpayKeyId,
    amount: input.amount,
    currency: input.currency,
  };
}

export function toVerifyPaymentDto(input: {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  alreadyFulfilled: boolean;
}): VerifyPaymentDto {
  return {
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    orderStatus: input.orderStatus,
    paymentStatus: input.paymentStatus,
    alreadyFulfilled: input.alreadyFulfilled,
  };
}

export function toRefundPaymentDto(input: {
  orderId: string;
  orderStatus: OrderStatus;
  refundStatus: string;
  alreadyCompleted: boolean;
}): RefundPaymentDto {
  return {
    orderId: input.orderId,
    orderStatus: input.orderStatus,
    refundStatus: input.refundStatus,
    alreadyCompleted: input.alreadyCompleted,
  };
}

export function toPaymentDetailsDto(input: {
  payment: {
    id: string;
    razorpayOrderId: string;
    razorpayPaymentId: string | null;
    amount: { toString(): string };
    paymentStatus: PaymentStatus;
    refundStatus: RefundStatus;
    createdAt: Date;
    updatedAt: Date;
  };
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  currency?: string;
}): PaymentDetailsDto {
  return {
    id: input.payment.id,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    orderStatus: input.orderStatus,
    razorpayOrderId: input.payment.razorpayOrderId,
    razorpayPaymentId: input.payment.razorpayPaymentId,
    amount: input.payment.amount.toString(),
    currency: input.currency ?? "INR",
    paymentStatus: input.payment.paymentStatus,
    refundStatus: input.payment.refundStatus,
    lifecycleStatus: resolvePaymentLifecycleStatus({
      paymentStatus: input.payment.paymentStatus,
      refundStatus: input.payment.refundStatus,
      orderStatus: input.orderStatus,
    }),
    createdAt: input.payment.createdAt.toISOString(),
    updatedAt: input.payment.updatedAt.toISOString(),
  };
}
