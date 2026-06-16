/**
 * Standardized API response helpers — all controllers must use these.
 */
import type { FieldError } from "../errors/app.errors.js";

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message?: string;
  data?: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors: FieldError[];
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedApiResponse<T> {
  success: true;
  message?: string;
  data: T[];
  meta: PaginatedMeta;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export function successResponse<T>(
  data: T,
  message?: string,
): ApiSuccessResponse<T> {
  return {
    success: true,
    message,
    data,
  };
}

export function errorResponse(
  message: string,
  errors: FieldError[] = [],
): ApiErrorResponse {
  return {
    success: false,
    message,
    errors,
  };
}

export function paginatedResponse<T>(
  data: T[],
  meta: PaginatedMeta,
  message?: string,
): PaginatedApiResponse<T> {
  return {
    success: true,
    message,
    data,
    meta,
  };
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginatedMeta {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
