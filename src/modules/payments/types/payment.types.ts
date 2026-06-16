import type { OrderStatus, PaymentStatus, RefundStatus } from "../../../../generated/prisma/client.js";

export interface FulfillSuccessfulPaymentInput {
  actorUserId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  source: "verify" | "webhook";
}

export interface PaymentFulfillmentResult {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  alreadyFulfilled: boolean;
}

export interface CreatePaymentOrderInput {
  orderId: string;
}

export interface VerifyPaymentInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface InitiateRefundInput {
  orderId: string;
}

export interface CompleteRefundInput {
  actorUserId: string;
  orderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  source: "webhook" | "admin";
}

export interface RefundResult {
  orderId: string;
  orderStatus: OrderStatus;
  refundStatus: RefundStatus;
  alreadyCompleted: boolean;
}
