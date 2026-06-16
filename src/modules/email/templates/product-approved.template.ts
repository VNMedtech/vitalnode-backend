import { EMAIL_SUBJECTS } from "../constants/email.constants.js";
import type { ProductApprovedEmailData, RenderedEmail } from "../types/email.types.js";
import { escapeHtml, greeting, renderEmailLayout } from "./layout.template.js";

export function renderProductApprovedEmail(data: ProductApprovedEmailData): RenderedEmail {
  const html = renderEmailLayout({
    title: "Product approved",
    preheader: `Your product "${data.productName}" is now live in the marketplace.`,
    bodyHtml: `<p>${escapeHtml(greeting(data.recipientName))}</p>
      <p>Your product <strong>${escapeHtml(data.productName)}</strong> has been approved.</p>
      <p>It is now visible to buyers in the marketplace.</p>`,
    ctaLabel: data.marketplaceUrl ? "View marketplace" : undefined,
    ctaUrl: data.marketplaceUrl,
  });

  const text = [
    greeting(data.recipientName),
    "",
    `Your product "${data.productName}" has been approved.`,
    "It is now visible to buyers in the marketplace.",
    data.marketplaceUrl ? `Marketplace: ${data.marketplaceUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: EMAIL_SUBJECTS.PRODUCT_APPROVED,
    html,
    text,
  };
}
