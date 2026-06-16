import { describe, expect, it } from "vitest";
import { EMAIL_TEMPLATE_IDS } from "../../../src/modules/email/constants/email.constants.js";
import { templateService } from "../../../src/modules/email/services/template.service.js";

describe("Email — TemplateService", () => {
  it("renders password reset email with link and text fallback", () => {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.PASSWORD_RESET, {
      recipientName: "Alex Buyer",
      resetLink: "https://app.example.com/reset-password?token=abc",
      expiresInMinutes: 30,
    });

    expect(rendered.subject).toBe("Reset your password");
    expect(rendered.html).toContain("Reset your password");
    expect(rendered.html).toContain("https://app.example.com/reset-password?token=abc");
    expect(rendered.text).toContain("Alex Buyer");
    expect(rendered.text).toContain("https://app.example.com/reset-password?token=abc");
  });

  it("renders seller approved email", () => {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.SELLER_APPROVED, {
      businessName: "MediSupply Co",
      dashboardUrl: "https://app.example.com/seller/dashboard",
    });

    expect(rendered.subject).toBe("Your seller account has been approved");
    expect(rendered.html).toContain("MediSupply Co");
    expect(rendered.text).toContain("Seller dashboard:");
  });

  it("renders seller rejected email with reason", () => {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.SELLER_REJECTED, {
      businessName: "MediSupply Co",
      reason: "Incomplete verification documents",
    });

    expect(rendered.subject).toBe("Your seller application was not approved");
    expect(rendered.html).toContain("Incomplete verification documents");
    expect(rendered.text).toContain("Incomplete verification documents");
  });

  it("renders product approved email", () => {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.PRODUCT_APPROVED, {
      productName: "Digital X-Ray Machine",
    });

    expect(rendered.subject).toBe("Your product has been approved");
    expect(rendered.html).toContain("Digital X-Ray Machine");
    expect(rendered.text).toContain("Digital X-Ray Machine");
  });

  it("renders product rejected email with reason", () => {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.PRODUCT_REJECTED, {
      productName: "Digital X-Ray Machine",
      reason: "Missing regulatory certification",
    });

    expect(rendered.subject).toBe("Your product was not approved");
    expect(rendered.html).toContain("Missing regulatory certification");
    expect(rendered.text).toContain("Missing regulatory certification");
  });
});
