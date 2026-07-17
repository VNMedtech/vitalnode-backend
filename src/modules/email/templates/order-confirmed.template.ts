import { EMAIL_SUBJECTS } from "../constants/email.constants.js";
import type { OrderConfirmedEmailData, RenderedEmail } from "../types/email.types.js";
import { escapeHtml, greeting, renderEmailLayout } from "./layout.template.js";

function roleMessage(data: OrderConfirmedEmailData): string {
  if (data.role === "SELLER") {
    return `Order <strong>${escapeHtml(data.orderNumber)}</strong> is confirmed for fulfillment via <strong>${escapeHtml(data.fulfillmentMethodLabel)}</strong>.`;
  }
  return `Your order <strong>${escapeHtml(data.orderNumber)}</strong> has been confirmed. Fulfillment: <strong>${escapeHtml(data.fulfillmentMethodLabel)}</strong>.`;
}

export function renderOrderConfirmedEmail(
  data: OrderConfirmedEmailData,
): RenderedEmail {
  const html = renderEmailLayout({
    title: "Order confirmed",
    preheader: `Order ${data.orderNumber} has been confirmed.`,
    bodyHtml: `<p>${escapeHtml(greeting(data.recipientName))}</p>
      <p>${roleMessage(data)}</p>
      <p>We will notify you when the order ships.</p>`,
    ctaLabel: data.orderUrl ? "View order" : undefined,
    ctaUrl: data.orderUrl,
  });

  const text = [
    greeting(data.recipientName),
    "",
    data.role === "SELLER"
      ? `Order ${data.orderNumber} is confirmed for fulfillment via ${data.fulfillmentMethodLabel}.`
      : `Your order ${data.orderNumber} has been confirmed. Fulfillment: ${data.fulfillmentMethodLabel}.`,
    data.orderUrl ? `View order: ${data.orderUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: EMAIL_SUBJECTS.ORDER_CONFIRMED,
    html,
    text,
  };
}
