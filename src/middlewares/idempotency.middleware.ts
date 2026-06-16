import type { RequestHandler } from "express";
import { ValidationError } from "../shared/errors/app.errors.js";

export const IDEMPOTENCY_HEADER = "idempotency-key";

export const requireIdempotencyKey: RequestHandler = (req, _res, next) => {
  const key = req.headers[IDEMPOTENCY_HEADER];
  const value = Array.isArray(key) ? key[0] : key;

  if (!value || value.trim().length === 0) {
    next(new ValidationError("Idempotency-Key header is required"));
    return;
  }

  req.idempotencyKey = value.trim();
  next();
};

export function getIdempotencyKey(
  req: Parameters<RequestHandler>[0],
): string | undefined {
  return req.idempotencyKey;
}
