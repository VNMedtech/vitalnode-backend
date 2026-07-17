import { z } from "zod";

export const sellerAddressIdParamSchema = z
  .object({
    id: z.string().uuid("Invalid warehouse address ID"),
  })
  .strict();

export type SellerAddressIdParam = z.infer<typeof sellerAddressIdParamSchema>;

export const sellerIdAddressesParamSchema = z
  .object({
    id: z.string().uuid("Invalid seller ID"),
  })
  .strict();

export type SellerIdAddressesParam = z.infer<
  typeof sellerIdAddressesParamSchema
>;
