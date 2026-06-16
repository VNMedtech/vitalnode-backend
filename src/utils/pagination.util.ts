/**
 * Pagination helpers — offset calculation and meta building.
 */
import type { PaginatedMeta } from "../shared/responses/api.response.js";

export function getPaginationOffset(page: number, limit: number): number {
  return (page - 1) * limit;
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
    totalPages: Math.ceil(total / limit),
  };
}
