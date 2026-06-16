/**
 * Centralized error handler — maps AppError hierarchy to standard HTTP responses.
 */
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { logger } from "../infrastructure/logger/logger.js";
import {
  AppError,
  ValidationError,
} from "../shared/errors/app.errors.js";
import { errorResponse } from "../shared/responses/api.response.js";
import { formatZodErrors } from "../shared/validators/zod.util.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ValidationError) {
    res.status(err.statusCode).json(errorResponse(err.message, err.errors));
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.message));
    return;
  }

  if (err instanceof ZodError) {
    res
      .status(400)
      .json(errorResponse("Validation failed", formatZodErrors(err)));
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
