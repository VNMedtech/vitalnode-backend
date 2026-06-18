import { randomUUID } from "node:crypto";

export function createPaymentOrderPayload(
  orderId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    orderId,
    ...overrides,
  };
}

export function verifyPaymentPayload(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  return { ...input };
}

export function refundPaymentPayload(
  orderId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    orderId,
    ...overrides,
  };
}

export function invalidOrderIdPayload() {
  return {
    orderId: "not-a-valid-uuid",
  };
}

export function missingOrderIdPayload() {
  return {};
}

export function randomRazorpayPaymentId(): string {
  return `pay_mock_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
}
