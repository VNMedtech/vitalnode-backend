import { EMAIL_SUBJECTS } from "../constants/email.constants.js";
import type { ProductRejectedEmailData, RenderedEmail } from "../types/email.types.js";
import { escapeHtml, greeting, renderEmailLayout } from "./layout.template.js";

export function renderProductRejectedEmail(data: ProductRejectedEmailData): RenderedEmail {
  const reasonBlock = data.reason
    ? `<p><strong>Reason:</strong> ${escapeHtml(data.reason)}</p>`
    : "";

  const html = renderEmailLayout({
    title: "Product not approved",
    preheader: `Your product "${data.productName}" was not approved.`,
    bodyHtml: `<p>${escapeHtml(greeting(data.recipientName))}</p>
      <p>Your product <strong>${escapeHtml(data.productName)}</strong> was not approved.</p>
      ${reasonBlock}
      <p>Review the feedback, update the listing if needed, and submit a new product for approval.</p>`,
    ctaLabel: data.supportUrl ? "Contact support" : undefined,
    ctaUrl: data.supportUrl,
  });

  const text = [
    greeting(data.recipientName),
    "",
    `Your product "${data.productName}" was not approved.`,
    data.reason ? `Reason: ${data.reason}` : "",
    "Review the feedback, update the listing if needed, and submit a new product for approval.",
    data.supportUrl ? `Support: ${data.supportUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: EMAIL_SUBJECTS.PRODUCT_REJECTED,
    html,
    text,
  };
}
