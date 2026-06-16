import { z } from "zod";

export const addressIdParamSchema = z
  .object({
    id: z.string().uuid("Invalid address ID"),
  })
  .strict();

export type AddressIdParam = z.infer<typeof addressIdParamSchema>;
