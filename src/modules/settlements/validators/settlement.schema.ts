import { z } from "zod";
import { SettlementBatchStatus } from "../../../../generated/prisma/client.js";
import {
  SETTLEMENT_DEFAULT_LIMIT,
  SETTLEMENT_DEFAULT_PAGE,
  SETTLEMENT_MAX_LIMIT,
  SETTLEMENT_SORT_FIELDS,
} from "../constants/settlement.constants.js";

export const settlementSellerIdParamSchema = z
  .object({
    sellerId: z.string().uuid("Invalid seller ID"),
  })
  .strict();

export type SettlementSellerIdParam = z.infer<
  typeof settlementSellerIdParamSchema
>;

export const createSettlementBatchBodySchema = z.object({
  sellerId: z.string().uuid("Invalid seller ID"),
  orderIds: z
    .array(z.string().uuid("Invalid order ID"))
    .min(1, "At least one order is required"),
  remarks: z.string().max(500).optional(),
});

export type CreateSettlementBatchBody = z.infer<
  typeof createSettlementBatchBodySchema
>;

export const disburseSettlementBatchBodySchema = z.object({
  paymentReference: z
    .string()
    .trim()
    .min(1, "Payment reference is required")
    .max(120),
  remarks: z.string().max(500).optional(),
});

export type DisburseSettlementBatchBody = z.infer<
  typeof disburseSettlementBatchBodySchema
>;

export const settlementIdParamSchema = z.object({
  id: z.string().uuid("Invalid settlement batch ID"),
});

export type SettlementIdParam = z.infer<typeof settlementIdParamSchema>;

export const listSettlementsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(SETTLEMENT_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(SETTLEMENT_MAX_LIMIT)
      .default(SETTLEMENT_DEFAULT_LIMIT),
    sortBy: z.enum(SETTLEMENT_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    sellerId: z.string().uuid("Invalid seller ID").optional(),
    status: z.nativeEnum(SettlementBatchStatus).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict();

export type ListSettlementsQueryInput = z.infer<
  typeof listSettlementsQuerySchema
>;
