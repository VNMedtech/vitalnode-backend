import { vi, type MockInstance } from "vitest";
import { razorpayClient } from "../../src/infrastructure/razorpay/index.js";
import type {
  RazorpayOrderCreateInput,
  RazorpayOrderResponse,
  RazorpayRefundInput,
  RazorpayRefundResponse,
} from "../../src/infrastructure/razorpay/razorpay.types.js";

let orderCounter = 0;
let refundCounter = 0;

export interface RazorpayMockHandles {
  createOrderSpy: MockInstance<
    (input: RazorpayOrderCreateInput) => Promise<RazorpayOrderResponse>
  >;
  createRefundSpy: MockInstance<
    (input: RazorpayRefundInput) => Promise<RazorpayRefundResponse>
  >;
  resetCounters: () => void;
}

export function mockRazorpayLayer(
  overrides: {
    onCreateOrder?: (
      input: RazorpayOrderCreateInput,
    ) => Promise<RazorpayOrderResponse>;
    onCreateRefund?: (
      input: RazorpayRefundInput,
    ) => Promise<RazorpayRefundResponse>;
  } = {},
): RazorpayMockHandles {
  orderCounter = 0;
  refundCounter = 0;

  const createOrderSpy = vi
    .spyOn(razorpayClient, "createOrder")
    .mockImplementation(
      overrides.onCreateOrder ??
        (async (input) => {
          if (input.amountPaise < 100) {
            throw new Error("Amount must be at least 100 paise");
          }

          orderCounter += 1;
          return {
            id: `order_mock_${orderCounter}`,
            amount: input.amountPaise,
            currency: input.currency ?? "INR",
            receipt: input.receipt,
            status: "created",
          };
        }),
    );

  const createRefundSpy = vi
    .spyOn(razorpayClient, "createRefund")
    .mockImplementation(
      overrides.onCreateRefund ??
        (async (input) => {
          refundCounter += 1;
          return {
            id: `rfnd_mock_${refundCounter}`,
            payment_id: input.paymentId,
            amount: input.amountPaise,
            status: "processed",
          };
        }),
    );

  return {
    createOrderSpy,
    createRefundSpy,
    resetCounters: () => {
      orderCounter = 0;
      refundCounter = 0;
    },
  };
}
