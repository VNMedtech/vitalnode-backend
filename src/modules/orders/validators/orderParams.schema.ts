import { z } from "zod";

export const orderIdParamSchema = z
  .object({
    id: z.string().uuid("Invalid order ID"),
  })
  .strict();

export type OrderIdParam = z.infer<typeof orderIdParamSchema>;
