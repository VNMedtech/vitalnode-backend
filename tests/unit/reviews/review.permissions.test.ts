import { describe, expect, it } from "vitest";
import { UserRole } from "../../../src/shared/enums/userRole.enum.js";
import {
  permissions,
  roleHasPermission,
} from "../../../src/shared/permissions/rbac.permissions.js";

describe("Review permissions", () => {
  it("grants buyers review create, update, and delete permissions", () => {
    expect(roleHasPermission(UserRole.BUYER, permissions.reviews.create)).toBe(
      true,
    );
    expect(roleHasPermission(UserRole.BUYER, permissions.reviews.update)).toBe(
      true,
    );
    expect(roleHasPermission(UserRole.BUYER, permissions.reviews.delete)).toBe(
      true,
    );
    expect(roleHasPermission(UserRole.BUYER, permissions.reviews.manage)).toBe(
      false,
    );
  });

  it("grants admin review management permission", () => {
    expect(roleHasPermission(UserRole.ADMIN, permissions.reviews.manage)).toBe(
      true,
    );
  });

  it("denies sellers review permissions", () => {
    expect(roleHasPermission(UserRole.SELLER, permissions.reviews.create)).toBe(
      false,
    );
    expect(roleHasPermission(UserRole.SELLER, permissions.reviews.manage)).toBe(
      false,
    );
  });
});
