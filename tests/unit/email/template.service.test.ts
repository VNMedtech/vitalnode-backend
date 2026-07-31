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

  it("renders order confirmed email without fulfillment method", () => {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.ORDER_CONFIRMED, {
      orderNumber: "ORD-1001",
      role: "BUYER",
    });

    expect(rendered.subject).toBe("Order confirmed");
    expect(rendered.html).toContain("ORD-1001");
    expect(rendered.html).not.toContain("Third-party courier");
    expect(rendered.text).toContain("ORD-1001");
  });

  it("renders order shipped email with tracking link", () => {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.ORDER_SHIPPED, {
      orderNumber: "ORD-1001",
      trackingUrl: "https://track.example.com/abc",
      carrier: "BlueDart",
      awbNumber: "AWB123",
      role: "BUYER",
    });

    expect(rendered.subject).toBe("Order shipped");
    expect(rendered.html).toContain("https://track.example.com/abc");
    expect(rendered.html).toContain("BlueDart");
    expect(rendered.html).toContain("AWB123");
    expect(rendered.text).toContain("Track shipment: https://track.example.com/abc");
  });

  it("renders delivery failed email with reason", () => {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.DELIVERY_FAILED, {
      orderNumber: "ORD-1001",
      reason: "Recipient unavailable",
      role: "SELLER",
    });

    expect(rendered.subject).toBe("Delivery failed");
    expect(rendered.html).toContain("Recipient unavailable");
    expect(rendered.text).toContain("Recipient unavailable");
  });

  it("renders order delivered email for buyer", () => {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.ORDER_DELIVERED, {
      orderNumber: "ORD-1001",
      orderUrl: "https://app.example.com/orders/abc",
      role: "BUYER",
    });

    expect(rendered.subject).toBe("Order delivered");
    expect(rendered.html).toContain("ORD-1001");
    expect(rendered.html).toContain("has been delivered successfully");
    expect(rendered.text).toContain("View order: https://app.example.com/orders/abc");
  });

  it("renders order delivered email for delivery partner", () => {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.ORDER_DELIVERED, {
      recipientName: "Ravi Partner",
      orderNumber: "ORD-1001",
      orderUrl: "https://app.example.com/delivery/orders/abc",
      role: "DELIVERY_PARTNER",
    });

    expect(rendered.subject).toBe("Delivery completed");
    expect(rendered.html).toContain("Delivery completed");
    expect(rendered.html).toContain("You have completed delivery of order");
    expect(rendered.html).toContain("ORD-1001");
    expect(rendered.text).toContain(
      "You have completed delivery of order ORD-1001.",
    );
    expect(rendered.text).toContain(
      "View order: https://app.example.com/delivery/orders/abc",
    );
  });
});
