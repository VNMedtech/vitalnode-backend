import { z } from "zod";

export const createOrderBodySchema = z
  .object({
    shippingAddressId: z.string().uuid("Invalid shipping address ID"),
  })
  .strict();

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
