/**
 * CORS configuration for Express.
 */
import { env } from "./env.js";

function parseCorsOrigins(origin: string): string | string[] {
  if (origin === "*") {
    return "*";
  }

  const origins = origin
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return origins.length === 1 ? origins[0]! : origins;
}

export const corsOptions = {
  origin: parseCorsOrigins(env.corsOrigin),
  credentials: true,
};
