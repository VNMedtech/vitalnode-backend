import { z } from "zod";
import {
  ORDER_DELIVERY_FAIL_REASON_MAX_LENGTH,
  ORDER_PROOF_URL_MAX_LENGTH,
} from "../constants/order.constants.js";

const proofFileUrlSchema = z
  .string()
  .trim()
  .url("Proof file URL must be valid")
  .max(ORDER_PROOF_URL_MAX_LENGTH);

export const orderProofBodySchema = z
  .object({
    fileUrl: proofFileUrlSchema,
  })
  .strict();

export const optionalOrderProofBodySchema = z
  .object({
    fileUrl: proofFileUrlSchema.optional(),
  })
  .strict();

export const emptyOrderStatusBodySchema = z.object({}).strict();

export const deliveryFailedBodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "Reason cannot be empty")
      .max(ORDER_DELIVERY_FAIL_REASON_MAX_LENGTH)
      .optional(),
  })
  .strict();

export type OrderProofBody = z.infer<typeof orderProofBodySchema>;
export type OptionalOrderProofBody = z.infer<typeof optionalOrderProofBodySchema>;
export type DeliveryFailedBody = z.infer<typeof deliveryFailedBodySchema>;
