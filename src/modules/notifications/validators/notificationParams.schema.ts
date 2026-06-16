import { z } from "zod";

export const notificationIdParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;
