import { z } from "zod";

export const assignDeliveryPartnerBodySchema = z
  .object({
    deliveryPartnerId: z.string().uuid("Invalid delivery partner ID"),
  })
  .strict();

export type AssignDeliveryPartnerBody = z.infer<
  typeof assignDeliveryPartnerBodySchema
>;
