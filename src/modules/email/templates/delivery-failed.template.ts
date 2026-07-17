import { EMAIL_SUBJECTS } from "../constants/email.constants.js";
import type { DeliveryFailedEmailData, RenderedEmail } from "../types/email.types.js";
import { escapeHtml, greeting, renderEmailLayout } from "./layout.template.js";

function roleMessage(data: DeliveryFailedEmailData): string {
  if (data.role === "SELLER") {
    return `Delivery of order <strong>${escapeHtml(data.orderNumber)}</strong> has failed.`;
  }
  return `Delivery of your order <strong>${escapeHtml(data.orderNumber)}</strong> could not be completed.`;
}

export function renderDeliveryFailedEmail(
  data: DeliveryFailedEmailData,
): RenderedEmail {
  const reasonBlock = data.reason
    ? `<p><strong>Reason:</strong> ${escapeHtml(data.reason)}</p>`
    : "";

  const html = renderEmailLayout({
    title: "Delivery failed",
    preheader: `Delivery failed for order ${data.orderNumber}.`,
    bodyHtml: `<p>${escapeHtml(greeting(data.recipientName))}</p>
      <p>${roleMessage(data)}</p>
      ${reasonBlock}
      <p>Please check the order details or contact support if you need help.</p>`,
    ctaLabel: data.orderUrl ? "View order" : undefined,
    ctaUrl: data.orderUrl,
  });

  const text = [
    greeting(data.recipientName),
    "",
    data.role === "SELLER"
      ? `Delivery of order ${data.orderNumber} has failed.`
      : `Delivery of your order ${data.orderNumber} could not be completed.`,
    data.reason ? `Reason: ${data.reason}` : "",
    data.orderUrl ? `View order: ${data.orderUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: EMAIL_SUBJECTS.DELIVERY_FAILED,
    html,
    text,
  };
}
