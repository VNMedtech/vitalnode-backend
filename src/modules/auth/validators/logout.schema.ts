import { z } from "zod";

export const logoutBodySchema = z.object({
  refreshToken: z.string().min(1),
});

