import { describe, expect, it } from "vitest";
import { SellerApprovalStatus } from "../../../src/shared/enums/sellerApprovalStatus.enum.js";
import { UserStatus } from "../../../src/shared/enums/userStatus.enum.js";
import { resolveVerificationStatus } from "../../../src/modules/admin/dto/adminUser.dto.js";

describe("Admin user DTO helpers", () => {
  describe("resolveVerificationStatus()", () => {
    it("returns PASSWORD_CHANGE_REQUIRED when mustChangePassword is true", () => {
      expect(
        resolveVerificationStatus({
          role: "BUYER",
          status: UserStatus.ACTIVE,
          mustChangePassword: true,
          sellerProfile: null,
        }),
      ).toBe("PASSWORD_CHANGE_REQUIRED");
    });

    it("returns SELLER_PENDING_APPROVAL for pending sellers", () => {
      expect(
        resolveVerificationStatus({
          role: "SELLER",
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
          sellerProfile: { approvalStatus: SellerApprovalStatus.PENDING_APPROVAL },
        }),
      ).toBe("SELLER_PENDING_APPROVAL");
    });

    it("returns SELLER_REJECTED for rejected sellers", () => {
      expect(
        resolveVerificationStatus({
          role: "SELLER",
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
          sellerProfile: { approvalStatus: SellerApprovalStatus.REJECTED },
        }),
      ).toBe("SELLER_REJECTED");
    });

    it("returns ACCOUNT_DISABLED for disabled users", () => {
      expect(
        resolveVerificationStatus({
          role: "BUYER",
          status: UserStatus.DISABLED,
          mustChangePassword: false,
          sellerProfile: null,
        }),
      ).toBe("ACCOUNT_DISABLED");
    });

    it("returns VERIFIED for active buyers", () => {
      expect(
        resolveVerificationStatus({
          role: "BUYER",
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
          sellerProfile: null,
        }),
      ).toBe("VERIFIED");
    });
  });
});
