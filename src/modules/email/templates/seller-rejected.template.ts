import { EMAIL_SUBJECTS } from "../constants/email.constants.js";
import type { RenderedEmail, SellerRejectedEmailData } from "../types/email.types.js";
import { escapeHtml, greeting, renderEmailLayout } from "./layout.template.js";

export function renderSellerRejectedEmail(data: SellerRejectedEmailData): RenderedEmail {
  const reasonBlock = data.reason
    ? `<p><strong>Reason:</strong> ${escapeHtml(data.reason)}</p>`
    : "";

  const html = renderEmailLayout({
    title: "Seller application update",
    preheader: `Your seller application for ${data.businessName} was not approved.`,
    bodyHtml: `<p>${escapeHtml(greeting(data.recipientName))}</p>
      <p>Your seller application for <strong>${escapeHtml(data.businessName)}</strong> was not approved at this time.</p>
      ${reasonBlock}
      <p>If you believe this decision was made in error, please contact support with any additional verification documents.</p>`,
    ctaLabel: data.supportUrl ? "Contact support" : undefined,
    ctaUrl: data.supportUrl,
  });

  const text = [
    greeting(data.recipientName),
    "",
    `Your seller application for ${data.businessName} was not approved at this time.`,
    data.reason ? `Reason: ${data.reason}` : "",
    "If you believe this decision was made in error, please contact support with any additional verification documents.",
    data.supportUrl ? `Support: ${data.supportUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: EMAIL_SUBJECTS.SELLER_REJECTED,
    html,
    text,
  };
}
