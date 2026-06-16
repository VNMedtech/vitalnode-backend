import { describe, expect, it } from "vitest";
import { SellerApprovalStatus } from "../../../src/shared/enums/sellerApprovalStatus.enum.js";
import {
  SELLER_APPROVAL_TRANSITIONS,
  assertSellerApprovalTransition,
  canTransitionSellerApproval,
} from "../../../src/shared/stateMachine/sellerApproval.guard.js";

const ALL_STATUSES = Object.values(SellerApprovalStatus);

describe("Seller Approval State Machine", () => {
  describe("valid transitions", () => {
    for (const from of ALL_STATUSES) {
      for (const to of SELLER_APPROVAL_TRANSITIONS[from]) {
        it(`allows ${from} -> ${to}`, () => {
          expect(canTransitionSellerApproval(from, to)).toBe(true);
          expect(() => assertSellerApprovalTransition(from, to)).not.toThrow();
        });
      }
    }
  });

  describe("invalid transitions", () => {
    for (const from of ALL_STATUSES) {
      const invalidTargets = ALL_STATUSES.filter(
        (to) =>
          to !== from && !SELLER_APPROVAL_TRANSITIONS[from].includes(to),
      );

      for (const to of invalidTargets) {
        it(`rejects ${from} -> ${to}`, () => {
          expect(canTransitionSellerApproval(from, to)).toBe(false);
          expect(() => assertSellerApprovalTransition(from, to)).toThrow(
            `Invalid seller approval transition: ${from} -> ${to}`,
          );
        });
      }
    }
  });
});
