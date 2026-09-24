import { z } from "zod";

export const createOrderBodySchema = z
  .object({
    shippingAddressId: z.string().uuid("Invalid shipping address ID"),
    couponCode: z
      .string()
      .trim()
      .min(4)
      .max(32)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "Coupon code may only contain letters, numbers, hyphens, and underscores",
      )
      .transform((value) => value.toUpperCase())
      .optional(),
  })
  .strict();

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
