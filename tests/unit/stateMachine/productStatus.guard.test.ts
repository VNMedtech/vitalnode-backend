import { describe, expect, it } from "vitest";
import { ProductStatus } from "../../../src/shared/enums/productStatus.enum.js";
import {
  PRODUCT_STATUS_TRANSITIONS,
  assertProductStatusTransition,
  canTransitionProductStatus,
} from "../../../src/shared/stateMachine/productStatus.guard.js";

const ALL_STATUSES = Object.values(ProductStatus);

describe("Product Status State Machine", () => {
  describe("valid transitions", () => {
    for (const from of ALL_STATUSES) {
      for (const to of PRODUCT_STATUS_TRANSITIONS[from]) {
        it(`allows ${from} -> ${to}`, () => {
          expect(canTransitionProductStatus(from, to)).toBe(true);
          expect(() => assertProductStatusTransition(from, to)).not.toThrow();
        });
      }
    }
  });

  describe("invalid transitions", () => {
    for (const from of ALL_STATUSES) {
      const invalidTargets = ALL_STATUSES.filter(
        (to) =>
          to !== from && !PRODUCT_STATUS_TRANSITIONS[from].includes(to),
      );

      for (const to of invalidTargets) {
        it(`rejects ${from} -> ${to}`, () => {
          expect(canTransitionProductStatus(from, to)).toBe(false);
          expect(() => assertProductStatusTransition(from, to)).toThrow(
            `Invalid product status transition: ${from} -> ${to}`,
          );
        });
      }
    }
  });
});
