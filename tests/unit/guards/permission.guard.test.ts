import { describe, expect, it } from "vitest";
import { ForbiddenError } from "../../../src/shared/errors/app.errors.js";
import { SellerApprovalStatus } from "../../../src/shared/enums/sellerApprovalStatus.enum.js";
import { UserRole } from "../../../src/shared/enums/userRole.enum.js";
import { assertPermission } from "../../../src/shared/guards/permission.guard.js";
import { permissions } from "../../../src/shared/permissions/rbac.permissions.js";

describe("assertPermission()", () => {
  it("does not throw when permission is granted", () => {
    expect(() =>
      assertPermission({ role: UserRole.ADMIN }, permissions.admin.manage),
    ).not.toThrow();
  });

  it("throws ForbiddenError when permission is denied", () => {
    expect(() =>
      assertPermission({ role: UserRole.BUYER }, permissions.products.create),
    ).toThrow(ForbiddenError);

    expect(() =>
      assertPermission({ role: UserRole.BUYER }, permissions.products.create),
    ).toThrow("Insufficient permissions");
  });

  it("throws ForbiddenError for unapproved seller operational access", () => {
    expect(() =>
      assertPermission(
        {
          role: UserRole.SELLER,
          sellerApprovalStatus: SellerApprovalStatus.PENDING_APPROVAL,
        },
        permissions.products.create,
      ),
    ).toThrow(ForbiddenError);
  });

  it("allows approved seller operational access", () => {
    expect(() =>
      assertPermission(
        {
          role: UserRole.SELLER,
          sellerApprovalStatus: SellerApprovalStatus.ACTIVE,
        },
        permissions.products.create,
      ),
    ).not.toThrow();
  });
});
