import { z } from "zod";

export const loginBodySchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1).max(72),
});
