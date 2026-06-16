import { z } from "zod";

export const authUserDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.string().min(1),
});

export const tokenPairDtoSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

export const loginResponseDtoSchema = z.object({
  user: authUserDtoSchema,
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

/**
 * auth — auth.dto
 * Data transfer objects — request/response shape definitions.
 */

export type authDto = Record<string, unknown>;
