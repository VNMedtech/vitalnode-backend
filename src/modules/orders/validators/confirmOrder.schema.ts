import { z } from "zod";
import { FulfillmentMethod } from "../../../../generated/prisma/client.js";

export const confirmOrderBodySchema = z
  .object({
    fulfillmentMethod: z.nativeEnum(FulfillmentMethod),
  })
  .strict();

export type ConfirmOrderBody = z.infer<typeof confirmOrderBodySchema>;

export const switchFulfillmentMethodBodySchema = confirmOrderBodySchema;

export type SwitchFulfillmentMethodBody = ConfirmOrderBody;
