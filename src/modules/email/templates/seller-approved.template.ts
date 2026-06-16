import { EMAIL_SUBJECTS } from "../constants/email.constants.js";
import type { RenderedEmail, SellerApprovedEmailData } from "../types/email.types.js";
import { escapeHtml, greeting, renderEmailLayout } from "./layout.template.js";

export function renderSellerApprovedEmail(data: SellerApprovedEmailData): RenderedEmail {
  const html = renderEmailLayout({
    title: "Seller account approved",
    preheader: `Your seller account for ${data.businessName} is now active.`,
    bodyHtml: `<p>${escapeHtml(greeting(data.recipientName))}</p>
      <p>Your seller account for <strong>${escapeHtml(data.businessName)}</strong> has been approved.</p>
      <p>You can now list products, manage inventory, and process orders on the marketplace.</p>`,
    ctaLabel: data.dashboardUrl ? "Open seller dashboard" : undefined,
    ctaUrl: data.dashboardUrl,
  });

  const text = [
    greeting(data.recipientName),
    "",
    `Your seller account for ${data.businessName} has been approved.`,
    "You can now list products, manage inventory, and process orders on the marketplace.",
    data.dashboardUrl ? `Seller dashboard: ${data.dashboardUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: EMAIL_SUBJECTS.SELLER_APPROVED,
    html,
    text,
  };
}
