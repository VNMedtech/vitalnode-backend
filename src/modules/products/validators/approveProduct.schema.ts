import { z } from "zod";

export const approveProductBodySchema = z.object({}).strict().default({});

export type ApproveProductBody = z.infer<typeof approveProductBodySchema>;
