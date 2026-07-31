import type { Prisma } from "../../../../generated/prisma/client.js";
import type { ProductSortField } from "../constants/product.constants.js";

export interface ProductSortOptions {
  sortBy?: ProductSortField;
  sortOrder?: "asc" | "desc";
  useMarketplaceDefaultSort?: boolean;
  /** Marketplace: APPROVED before OUT_OF_STOCK (alphabetical). */
  preferInStockFirst?: boolean;
}

function mapSortField(
  sortBy: ProductSortField,
): keyof Prisma.ProductOrderByWithRelationInput {
  switch (sortBy) {
    case "price":
      return "pricing";
    case "newest":
    default:
      return "createdAt";
  }
}

function resolveExplicitSortOrder(
  sortBy: ProductSortField,
  sortOrder?: "asc" | "desc",
): "asc" | "desc" {
  if (sortOrder) {
    return sortOrder;
  }

  return sortBy === "newest" ? "desc" : "asc";
}

export function usesMarketplaceDefaultSort(
  sortBy?: ProductSortField,
  sortOrder?: "asc" | "desc",
): boolean {
  return sortBy === undefined && sortOrder === undefined;
}

export function buildProductOrderBy(
  options: ProductSortOptions,
): Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] {
  const primary: Prisma.ProductOrderByWithRelationInput = options.useMarketplaceDefaultSort
    ? { pricing: "asc" }
    : (() => {
        const sortBy = options.sortBy ?? "newest";
        const sortOrder = resolveExplicitSortOrder(sortBy, options.sortOrder);
        const sortField = mapSortField(sortBy);
        return { [sortField]: sortOrder };
      })();

  if (options.preferInStockFirst) {
    return [{ status: "asc" }, primary];
  }

  if (options.useMarketplaceDefaultSort) {
    return [primary];
  }

  return primary;
}
