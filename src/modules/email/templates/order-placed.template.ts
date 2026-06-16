import { EMAIL_SUBJECTS } from "../constants/email.constants.js";
import type { OrderPlacedEmailData, RenderedEmail } from "../types/email.types.js";
import { escapeHtml, greeting, renderEmailLayout } from "./layout.template.js";

function roleMessage(data: OrderPlacedEmailData): string {
  if (data.role === "SELLER") {
    return `You have received a new order <strong>${escapeHtml(data.orderNumber)}</strong> for <strong>₹${escapeHtml(data.totalAmount)}</strong>.`;
  }
  return `Your order <strong>${escapeHtml(data.orderNumber)}</strong> has been placed successfully. Total: <strong>₹${escapeHtml(data.totalAmount)}</strong>.`;
}

export function renderOrderPlacedEmail(data: OrderPlacedEmailData): RenderedEmail {
  const html = renderEmailLayout({
    title: "Order placed",
    preheader: `Order ${data.orderNumber} has been placed.`,
    bodyHtml: `<p>${escapeHtml(greeting(data.recipientName))}</p>
      <p>${roleMessage(data)}</p>
      <p>We will notify you as the order progresses through fulfillment and delivery.</p>`,
    ctaLabel: data.orderUrl ? "View order" : undefined,
    ctaUrl: data.orderUrl,
  });

  const text = [
    greeting(data.recipientName),
    "",
    data.role === "SELLER"
      ? `You have received a new order ${data.orderNumber} for ₹${data.totalAmount}.`
      : `Your order ${data.orderNumber} has been placed successfully. Total: ₹${data.totalAmount}.`,
    data.orderUrl ? `View order: ${data.orderUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: EMAIL_SUBJECTS.ORDER_PLACED,
    html,
    text,
  };
}
