import { describe, expect, it } from "vitest";
import { SellerApprovalStatus } from "../../../src/shared/enums/sellerApprovalStatus.enum.js";
import { UserRole } from "../../../src/shared/enums/userRole.enum.js";
import {
  permissions,
  roleHasPermission,
  rolesHavePermission,
} from "../../../src/shared/permissions/rbac.permissions.js";
import {
  resolveSellerPermissions,
  sellerHasPermission,
  userHasPermission,
} from "../../../src/shared/permissions/seller.permissions.js";

describe("Permission system", () => {
  describe("roleHasPermission()", () => {
    it("grants admin all permissions", () => {
      expect(
        roleHasPermission(UserRole.ADMIN, permissions.orders.assignDelivery),
      ).toBe(true);
      expect(
        roleHasPermission(UserRole.ADMIN, permissions.products.approve),
      ).toBe(true);
      expect(roleHasPermission(UserRole.ADMIN, permissions.users.list)).toBe(true);
      expect(roleHasPermission(UserRole.ADMIN, permissions.users.disable)).toBe(
        true,
      );
    });

    it("grants buyer cart and order permissions", () => {
      expect(roleHasPermission(UserRole.BUYER, permissions.cart.mutate)).toBe(
        true,
      );
      expect(roleHasPermission(UserRole.BUYER, permissions.orders.create)).toBe(
        true,
      );
      expect(
        roleHasPermission(UserRole.BUYER, permissions.products.create),
      ).toBe(false);
    });

    it("grants seller inventory permissions at role level", () => {
      expect(
        roleHasPermission(UserRole.SELLER, permissions.inventory.update),
      ).toBe(true);
      expect(
        roleHasPermission(UserRole.SELLER, permissions.orders.assignDelivery),
      ).toBe(false);
    });
  });

  describe("rolesHavePermission()", () => {
    it("returns true when any role has the permission", () => {
      expect(
        rolesHavePermission(
          [UserRole.BUYER, UserRole.SELLER],
          permissions.cart.read,
        ),
      ).toBe(true);
    });

    it("returns false when no role has the permission", () => {
      expect(
        rolesHavePermission(
          [UserRole.BUYER, UserRole.DELIVERY_PARTNER],
          permissions.admin.manage,
        ),
      ).toBe(false);
    });
  });

  describe("seller approval status checks", () => {
    it("grants operational permissions only to ACTIVE sellers", () => {
      expect(
        sellerHasPermission(
          SellerApprovalStatus.ACTIVE,
          permissions.products.create,
        ),
      ).toBe(true);
      expect(
        sellerHasPermission(
          SellerApprovalStatus.PENDING_APPROVAL,
          permissions.products.create,
        ),
      ).toBe(false);
      expect(
        sellerHasPermission(
          SellerApprovalStatus.REJECTED,
          permissions.products.create,
        ),
      ).toBe(false);
    });

    it("allows profile update while pending approval", () => {
      expect(
        sellerHasPermission(
          SellerApprovalStatus.PENDING_APPROVAL,
          permissions.users.updateProfile,
        ),
      ).toBe(true);
    });

    it("allows account permissions for rejected sellers", () => {
      expect(
        sellerHasPermission(
          SellerApprovalStatus.REJECTED,
          permissions.users.readProfile,
        ),
      ).toBe(true);
      expect(
        sellerHasPermission(
          SellerApprovalStatus.REJECTED,
          permissions.users.changePassword,
        ),
      ).toBe(true);
    });

    it("resolveSellerPermissions returns stable sets per status", () => {
      const active = resolveSellerPermissions(SellerApprovalStatus.ACTIVE);
      const pending = resolveSellerPermissions(
        SellerApprovalStatus.PENDING_APPROVAL,
      );

      expect(active.has(permissions.products.create)).toBe(true);
      expect(pending.has(permissions.products.create)).toBe(false);
      expect(pending.has(permissions.users.updateProfile)).toBe(true);
    });
  });

  describe("userHasPermission()", () => {
    it("delegates to role permissions for non-sellers", () => {
      expect(
        userHasPermission(
          { role: UserRole.BUYER },
          permissions.addresses.create,
        ),
      ).toBe(true);
    });

    it("requires seller approval status for sellers", () => {
      expect(
        userHasPermission(
          { role: UserRole.SELLER },
          permissions.products.create,
        ),
      ).toBe(false);

      expect(
        userHasPermission(
          {
            role: UserRole.SELLER,
            sellerApprovalStatus: SellerApprovalStatus.ACTIVE,
          },
          permissions.products.create,
        ),
      ).toBe(true);
    });

    it("denies disabled seller operational access", () => {
      expect(
        userHasPermission(
          {
            role: UserRole.SELLER,
            sellerApprovalStatus: SellerApprovalStatus.DISABLED,
          },
          permissions.inventory.update,
        ),
      ).toBe(false);
      expect(
        userHasPermission(
          {
            role: UserRole.SELLER,
            sellerApprovalStatus: SellerApprovalStatus.DISABLED,
          },
          permissions.users.changePassword,
        ),
      ).toBe(true);
    });
  });
});
