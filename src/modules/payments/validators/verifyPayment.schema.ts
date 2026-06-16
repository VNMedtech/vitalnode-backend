import { z } from "zod";

export const verifyPaymentBodySchema = z.object({
  razorpayOrderId: z.string().min(1, "razorpayOrderId is required"),
  razorpayPaymentId: z.string().min(1, "razorpayPaymentId is required"),
  razorpaySignature: z.string().min(1, "razorpaySignature is required"),
});

export type VerifyPaymentBody = z.infer<typeof verifyPaymentBodySchema>;
