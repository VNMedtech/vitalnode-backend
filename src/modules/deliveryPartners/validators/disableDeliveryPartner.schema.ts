import { z } from "zod";
import { DELIVERY_PARTNER_REASON_MAX_LENGTH } from "../constants/deliveryPartner.constants.js";

export const disableDeliveryPartnerBodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1)
      .max(DELIVERY_PARTNER_REASON_MAX_LENGTH)
      .optional(),
  })
  .strict()
  .default({});

export type DisableDeliveryPartnerBody = z.infer<
  typeof disableDeliveryPartnerBodySchema
>;
