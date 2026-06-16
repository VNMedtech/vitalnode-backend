/**
 * CORS configuration for Express.
 */

export const corsOptions = {
  origin: process.env.CORS_ORIGIN ?? "*",
  credentials: true,
};
