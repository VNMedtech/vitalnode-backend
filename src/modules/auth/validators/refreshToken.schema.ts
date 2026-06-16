import { z } from "zod";

export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().min(1),
});
