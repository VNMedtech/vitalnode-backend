import { z } from "zod";
import {
  PRODUCT_COMPARE_MAX_COUNT,
  PRODUCT_COMPARE_MIN_COUNT,
} from "../constants/product.constants.js";

function normalizeProductIdsQuery(value: unknown): string[] {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry !== "string") {
        return [];
      }
      return entry
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    });
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

const productIdsSchema = z
  .preprocess(
    normalizeProductIdsQuery,
    z
      .array(z.string().uuid("Invalid product ID"))
      .min(
        PRODUCT_COMPARE_MIN_COUNT,
        `At least ${PRODUCT_COMPARE_MIN_COUNT} products are required for comparison`,
      )
      .max(
        PRODUCT_COMPARE_MAX_COUNT,
        `A maximum of ${PRODUCT_COMPARE_MAX_COUNT} products can be compared`,
      ),
  )
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Duplicate product IDs are not allowed",
  });

export const compareProductsQuerySchema = z
  .object({
    productIds: productIdsSchema,
  })
  .strict();

export type CompareProductsQueryInput = z.infer<
  typeof compareProductsQuerySchema
>;
