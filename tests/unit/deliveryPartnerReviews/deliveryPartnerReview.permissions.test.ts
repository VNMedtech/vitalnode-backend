import { describe, expect, it } from "vitest";
import { UserRole } from "../../../src/shared/enums/userRole.enum.js";
import {
  permissions,
  roleHasPermission,
} from "../../../src/shared/permissions/rbac.permissions.js";

describe("Delivery partner review permissions", () => {
  it("grants buyers create, update, and read permissions", () => {
    expect(
      roleHasPermission(
        UserRole.BUYER,
        permissions.deliveryPartnerReviews.create,
      ),
    ).toBe(true);
    expect(
      roleHasPermission(
        UserRole.BUYER,
        permissions.deliveryPartnerReviews.update,
      ),
    ).toBe(true);
    expect(
      roleHasPermission(
        UserRole.BUYER,
        permissions.deliveryPartnerReviews.read,
      ),
    ).toBe(true);
    expect(
      roleHasPermission(
        UserRole.BUYER,
        permissions.deliveryPartnerReviews.manage,
      ),
    ).toBe(false);
  });

  it("grants delivery partners read permission only", () => {
    expect(
      roleHasPermission(
        UserRole.DELIVERY_PARTNER,
        permissions.deliveryPartnerReviews.read,
      ),
    ).toBe(true);
    expect(
      roleHasPermission(
        UserRole.DELIVERY_PARTNER,
        permissions.deliveryPartnerReviews.create,
      ),
    ).toBe(false);
    expect(
      roleHasPermission(
        UserRole.DELIVERY_PARTNER,
        permissions.deliveryPartnerReviews.manage,
      ),
    ).toBe(false);
  });

  it("grants admin manage permission", () => {
    expect(
      roleHasPermission(
        UserRole.ADMIN,
        permissions.deliveryPartnerReviews.manage,
      ),
    ).toBe(true);
  });

  it("denies sellers delivery partner review permissions", () => {
    expect(
      roleHasPermission(
        UserRole.SELLER,
        permissions.deliveryPartnerReviews.create,
      ),
    ).toBe(false);
    expect(
      roleHasPermission(
        UserRole.SELLER,
        permissions.deliveryPartnerReviews.manage,
      ),
    ).toBe(false);
  });
});
