import { EMAIL_SUBJECTS } from "../constants/email.constants.js";
import type { OrderDeliveredEmailData, RenderedEmail } from "../types/email.types.js";
import { escapeHtml, greeting, renderEmailLayout } from "./layout.template.js";

function roleMessage(data: OrderDeliveredEmailData): string {
  if (data.role === "SELLER") {
    return `Order <strong>${escapeHtml(data.orderNumber)}</strong> has been marked as delivered.`;
  }
  return `Your order <strong>${escapeHtml(data.orderNumber)}</strong> has been delivered successfully.`;
}

export function renderOrderDeliveredEmail(
  data: OrderDeliveredEmailData,
): RenderedEmail {
  const html = renderEmailLayout({
    title: "Order delivered",
    preheader: `Order ${data.orderNumber} has been delivered.`,
    bodyHtml: `<p>${escapeHtml(greeting(data.recipientName))}</p>
      <p>${roleMessage(data)}</p>
      <p>Thank you for using the Medical Equipment Marketplace.</p>`,
    ctaLabel: data.orderUrl ? "View order" : undefined,
    ctaUrl: data.orderUrl,
  });

  const text = [
    greeting(data.recipientName),
    "",
    data.role === "SELLER"
      ? `Order ${data.orderNumber} has been marked as delivered.`
      : `Your order ${data.orderNumber} has been delivered successfully.`,
    data.orderUrl ? `View order: ${data.orderUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: EMAIL_SUBJECTS.ORDER_DELIVERED,
    html,
    text,
  };
}
