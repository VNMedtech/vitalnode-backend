/**
 * Application error hierarchy — all thrown errors should extend AppError.
 */
export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  public readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string,
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly errors: FieldError[];

  constructor(message = "Validation failed", errors: FieldError[] = []) {
    super(message, 400, "VALIDATION_ERROR");
    this.errors = errors;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409, "CONFLICT");
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests, please try again later") {
    super(message, 429, "TOO_MANY_REQUESTS");
  }
}
