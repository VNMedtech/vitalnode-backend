/**
 * Shared Zod utilities for consistent validation error formatting.
 */
import { ZodError } from "zod";
import type { FieldError } from "../errors/app.errors.js";

export function formatZodErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "root",
    message: issue.message,
  }));
}
