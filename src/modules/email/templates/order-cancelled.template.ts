import { EMAIL_SUBJECTS } from "../constants/email.constants.js";
import type { OrderCancelledEmailData, RenderedEmail } from "../types/email.types.js";
import { escapeHtml, greeting, renderEmailLayout } from "./layout.template.js";

function roleMessage(data: OrderCancelledEmailData): string {
  if (data.role === "SELLER") {
    return `Order <strong>${escapeHtml(data.orderNumber)}</strong> has been cancelled.`;
  }
  return `Your order <strong>${escapeHtml(data.orderNumber)}</strong> has been cancelled.`;
}

export function renderOrderCancelledEmail(
  data: OrderCancelledEmailData,
): RenderedEmail {
  const reasonBlock = data.reason
    ? `<p><strong>Reason:</strong> ${escapeHtml(data.reason)}</p>`
    : "";

  const html = renderEmailLayout({
    title: "Order cancelled",
    preheader: `Order ${data.orderNumber} has been cancelled.`,
    bodyHtml: `<p>${escapeHtml(greeting(data.recipientName))}</p>
      <p>${roleMessage(data)}</p>
      ${reasonBlock}
      <p>If a payment was captured, any eligible refund will be processed according to marketplace policy.</p>`,
    ctaLabel: data.orderUrl ? "View order" : undefined,
    ctaUrl: data.orderUrl,
  });

  const text = [
    greeting(data.recipientName),
    "",
    data.role === "SELLER"
      ? `Order ${data.orderNumber} has been cancelled.`
      : `Your order ${data.orderNumber} has been cancelled.`,
    data.reason ? `Reason: ${data.reason}` : "",
    data.orderUrl ? `View order: ${data.orderUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: EMAIL_SUBJECTS.ORDER_CANCELLED,
    html,
    text,
  };
}
