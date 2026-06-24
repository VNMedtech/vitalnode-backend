import { z } from "zod";

export const approveSellerBodySchema = z.object({
  commissionPercentage: z
    .number({ error: "Commission percentage is required" })
    .min(0, "Commission percentage must be at least 0")
    .max(100, "Commission percentage must be at most 100"),
});

export type ApproveSellerBody = z.infer<typeof approveSellerBodySchema>;

export const updateSellerCommissionBodySchema = z.object({
  commissionPercentage: z
    .number({ error: "Commission percentage is required" })
    .min(0, "Commission percentage must be at least 0")
    .max(100, "Commission percentage must be at most 100"),
});

export type UpdateSellerCommissionBody = z.infer<
  typeof updateSellerCommissionBodySchema
>;
