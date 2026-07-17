import { z } from "zod";
import { FulfillmentMethod } from "../../../../generated/prisma/client.js";

export const confirmOrderBodySchema = z
  .object({
    fulfillmentMethod: z.nativeEnum(FulfillmentMethod),
    pickupAddressId: z.string().uuid("Invalid pickup address ID"),
  })
  .strict();

export type ConfirmOrderBody = z.infer<typeof confirmOrderBodySchema>;

export const switchFulfillmentMethodBodySchema = z
  .object({
    fulfillmentMethod: z.nativeEnum(FulfillmentMethod),
  })
  .strict();

export type SwitchFulfillmentMethodBody = z.infer<
  typeof switchFulfillmentMethodBodySchema
>;
