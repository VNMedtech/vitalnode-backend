/**
 * Centralized error handler — maps AppError hierarchy to standard HTTP responses.
 */
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { env } from "../config/env.js";
import { logger } from "../infrastructure/logger/logger.js";
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../shared/errors/app.errors.js";
import { errorResponse } from "../shared/responses/api.response.js";
import { formatZodErrors } from "../shared/validators/zod.util.js";

/**
 * Map Prisma known-request errors to operational AppErrors with client-safe messages.
 * Does not leak schema/table/column internals in production.
 * Client-facing constraint codes stay 4xx; unknown Prisma failures are server/upstream errors.
 */
export function mapPrismaKnownRequestError(
  err: Prisma.PrismaClientKnownRequestError,
): AppError {
  switch (err.code) {
    case "P2002":
      return new ConflictError("A record with this value already exists");
    case "P2025":
      return new NotFoundError("Resource not found");
    case "P2003":
      return new ConflictError("Related resource constraint failed");
    case "P2011":
      return new ValidationError("Required value is missing");
    case "P2014":
      return new ConflictError("Invalid related resource");
    case "P2034":
      return new ConflictError("Transaction conflict, please retry");
    default: {
      const message =
        env.nodeEnv === "production"
          ? "Database request failed"
          : err.message;
      // Unknown Prisma codes are not client validation errors — treat as server failure.
      return new AppError(message, 500, "PRISMA_ERROR");
    }
  }
}

function respondWithAppError(
  res: Parameters<ErrorRequestHandler>[2],
  err: AppError,
): void {
  const fieldErrors = err instanceof ValidationError ? err.errors : [];
  res
    .status(err.statusCode)
    .json(errorResponse(err.message, fieldErrors, err.code));
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ValidationError || err instanceof AppError) {
    respondWithAppError(res, err);
    return;
  }

  if (err instanceof ZodError) {
    res
      .status(400)
      .json(errorResponse("Validation failed", formatZodErrors(err), "VALIDATION_ERROR"));
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaKnownRequestError(err);
    if (err.code !== "P2002" && err.code !== "P2025") {
      logger.error(
        {
          code: err.code,
          message: err.message,
          meta: err.meta,
          method: req.method,
          path: req.originalUrl,
        },
        "Prisma known request error",
      );
    }
    respondWithAppError(res, mapped);
    return;
  }

  logger.error(
    {
      message: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack : undefined,
      method: req.method,
      path: req.originalUrl,
    },
    "Unhandled error",
  );

  const message =
    env.nodeEnv === "production"
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : "Internal server error";

  res.status(500).json(errorResponse(message));
};
