import { z } from "zod";

export const approveSellerBodySchema = z.object({}).strict();

export type ApproveSellerBody = z.infer<typeof approveSellerBodySchema>;
