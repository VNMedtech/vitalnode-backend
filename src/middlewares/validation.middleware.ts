/**
 * Zod schema validation middleware — validates body, query, and params before controllers.
 */
import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";
import { ValidationError } from "../shared/errors/app.errors.js";
import { formatZodErrors } from "../shared/validators/zod.util.js";

export interface RequestValidationSchema {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

function assignReadOnlyRequestField<T>(
  req: Parameters<RequestHandler>[0],
  key: "query" | "params",
  value: T,
): void {
  Object.defineProperty(req, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

export function validate(schemas: RequestValidationSchema): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      if (schemas.query) {
        assignReadOnlyRequestField(
          req,
          "query",
          schemas.query.parse(req.query),
        );
      }

      if (schemas.params) {
        assignReadOnlyRequestField(
          req,
          "params",
          schemas.params.parse(req.params),
        );
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError("Validation failed", formatZodErrors(error)));
        return;
      }

      next(error);
    }
  };
}
