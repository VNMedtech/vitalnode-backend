import { z } from "zod";

export const deliveryPartnerIdParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export type DeliveryPartnerIdParam = z.infer<
  typeof deliveryPartnerIdParamSchema
>;
