import { describe, expect, it } from "vitest";
import {
  buildProductOrderBy,
  usesMarketplaceDefaultSort,
} from "../../../src/modules/products/utils/productSort.util.js";

describe("productSort.util", () => {
  describe("usesMarketplaceDefaultSort", () => {
    it("returns true when both sort params are omitted", () => {
      expect(usesMarketplaceDefaultSort(undefined, undefined)).toBe(true);
    });

    it("returns false when sortBy is provided", () => {
      expect(usesMarketplaceDefaultSort("price", undefined)).toBe(false);
    });

    it("returns false when sortOrder is provided", () => {
      expect(usesMarketplaceDefaultSort(undefined, "asc")).toBe(false);
    });

    it("returns false when both sort params are provided", () => {
      expect(usesMarketplaceDefaultSort("newest", "desc")).toBe(false);
    });
  });

  describe("buildProductOrderBy", () => {
    it("uses pricing ascending for marketplace default sort", () => {
      expect(
        buildProductOrderBy({ useMarketplaceDefaultSort: true }),
      ).toEqual([{ pricing: "asc" }]);
    });

    it("puts in-stock before out-of-stock on marketplace default sort", () => {
      expect(
        buildProductOrderBy({
          useMarketplaceDefaultSort: true,
          preferInStockFirst: true,
        }),
      ).toEqual([{ status: "asc" }, { pricing: "asc" }]);
    });

    it("puts in-stock first ahead of explicit price sort", () => {
      expect(
        buildProductOrderBy({
          sortBy: "price",
          sortOrder: "desc",
          preferInStockFirst: true,
        }),
      ).toEqual([{ status: "asc" }, { pricing: "desc" }]);
    });

    it("maps explicit price ascending sort", () => {
      expect(
        buildProductOrderBy({ sortBy: "price", sortOrder: "asc" }),
      ).toEqual({ pricing: "asc" });
    });

    it("maps explicit price descending sort", () => {
      expect(
        buildProductOrderBy({ sortBy: "price", sortOrder: "desc" }),
      ).toEqual({ pricing: "desc" });
    });

    it("defaults newest to createdAt descending when sortOrder is omitted", () => {
      expect(buildProductOrderBy({ sortBy: "newest" })).toEqual({
        createdAt: "desc",
      });
    });

    it("falls back to newest when no marketplace default and no sortBy", () => {
      expect(buildProductOrderBy({})).toEqual({ createdAt: "desc" });
    });
  });
});
