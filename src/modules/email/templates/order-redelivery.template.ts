import { EMAIL_SUBJECTS } from "../constants/email.constants.js";
import type { OrderRedeliveryEmailData, RenderedEmail } from "../types/email.types.js";
import { escapeHtml, greeting, renderEmailLayout } from "./layout.template.js";

function roleMessage(data: OrderRedeliveryEmailData): string {
  if (data.role === "SELLER") {
    return `A new delivery attempt (#${data.attemptNumber}) has been started for order <strong>${escapeHtml(data.orderNumber)}</strong>. Platform fulfillment setup will follow shortly.`;
  }
  return `We are arranging a new delivery attempt (#${data.attemptNumber}) for your order <strong>${escapeHtml(data.orderNumber)}</strong>. We will notify you when it ships.`;
}

export function renderOrderRedeliveryEmail(
  data: OrderRedeliveryEmailData,
): RenderedEmail {
  const html = renderEmailLayout({
    title: "New delivery attempt",
    preheader: `A new delivery attempt for order ${data.orderNumber} has been scheduled.`,
    bodyHtml: `<p>${escapeHtml(greeting(data.recipientName))}</p>
      <p>${roleMessage(data)}</p>`,
    ctaLabel: data.orderUrl ? "View order" : undefined,
    ctaUrl: data.orderUrl,
  });

  const text = [
    greeting(data.recipientName),
    "",
    data.role === "SELLER"
      ? `A new delivery attempt (#${data.attemptNumber}) has been started for order ${data.orderNumber}. Platform fulfillment setup will follow shortly.`
      : `We are arranging a new delivery attempt (#${data.attemptNumber}) for your order ${data.orderNumber}. We will notify you when it ships.`,
    data.orderUrl ? `View order: ${data.orderUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: EMAIL_SUBJECTS.ORDER_REDELIVERY,
    html,
    text,
  };
}
