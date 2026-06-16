import Razorpay from "razorpay";
import { env } from "../../config/env.js";
import { logger } from "../logger/logger.js";
import type {
  RazorpayOrderCreateInput,
  RazorpayOrderResponse,
  RazorpayRefundInput,
  RazorpayRefundResponse,
} from "./razorpay.types.js";

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertConfigured(): { keyId: string; keySecret: string } {
  const { keyId, keySecret } = env.razorpay;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured");
  }
  return { keyId, keySecret };
}

export class RazorpayClient {
  private instance: Razorpay | null = null;

  private getClient(): Razorpay {
    if (!this.instance) {
      const { keyId, keySecret } = assertConfigured();
      this.instance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    }
    return this.instance;
  }

  getKeyId(): string {
    return assertConfigured().keyId;
  }

  async createOrder(
    input: RazorpayOrderCreateInput,
  ): Promise<RazorpayOrderResponse> {
    const client = this.getClient();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const order = await client.orders.create({
          amount: input.amountPaise,
          currency: input.currency ?? "INR",
          receipt: input.receipt,
          notes: input.notes,
        });

        return {
          id: order.id,
          amount: Number(order.amount),
          currency: order.currency,
          receipt: order.receipt ?? input.receipt,
          status: order.status,
        };
      } catch (error) {
        if (attempt === MAX_ATTEMPTS) {
          throw error;
        }
        logger.warn(
          {
            attempt,
            receipt: input.receipt,
            message: error instanceof Error ? error.message : "Unknown error",
          },
          "Razorpay order creation retry",
        );
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }

    throw new Error("Razorpay createOrder: unreachable");
  }

  async createRefund(
    input: RazorpayRefundInput,
  ): Promise<RazorpayRefundResponse> {
    const client = this.getClient();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const refund = await client.payments.refund(input.paymentId, {
          amount: input.amountPaise,
          notes: input.notes,
        });

        return {
          id: refund.id,
          payment_id: refund.payment_id,
          amount: Number(refund.amount),
          status: refund.status,
        };
      } catch (error) {
        if (attempt === MAX_ATTEMPTS) {
          throw error;
        }
        logger.warn(
          {
            attempt,
            paymentId: input.paymentId,
            message: error instanceof Error ? error.message : "Unknown error",
          },
          "Razorpay refund retry",
        );
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }

    throw new Error("Razorpay createRefund: unreachable");
  }
}

export const razorpayClient = new RazorpayClient();
