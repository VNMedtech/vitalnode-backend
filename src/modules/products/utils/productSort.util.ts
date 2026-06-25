import type { Prisma } from "../../../../generated/prisma/client.js";
import type { ProductSortField } from "../constants/product.constants.js";

export interface ProductSortOptions {
  sortBy?: ProductSortField;
  sortOrder?: "asc" | "desc";
  useMarketplaceDefaultSort?: boolean;
}

function mapSortField(
  sortBy: ProductSortField,
): keyof Prisma.ProductOrderByWithRelationInput {
  switch (sortBy) {
    case "price":
      return "pricing";
    case "deliveryTime":
      return "deliveryTime";
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
  if (options.useMarketplaceDefaultSort) {
    return [
      { deliveryTime: { sort: "asc", nulls: "last" } },
      { pricing: "asc" },
    ];
  }

  const sortBy = options.sortBy ?? "newest";
  const sortOrder = resolveExplicitSortOrder(sortBy, options.sortOrder);
  const sortField = mapSortField(sortBy);

  return {
    [sortField]: sortOrder,
  };
}
