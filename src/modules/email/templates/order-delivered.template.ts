import { EMAIL_SUBJECTS } from "../constants/email.constants.js";
import type { OrderDeliveredEmailData, RenderedEmail } from "../types/email.types.js";
import { escapeHtml, greeting, renderEmailLayout } from "./layout.template.js";

function roleMessage(data: OrderDeliveredEmailData): string {
  switch (data.role) {
    case "DELIVERY_PARTNER":
      return `You have completed delivery of order <strong>${escapeHtml(data.orderNumber)}</strong>.`;
    case "SELLER":
      return `Order <strong>${escapeHtml(data.orderNumber)}</strong> has been marked as delivered.`;
    default:
      return `Your order <strong>${escapeHtml(data.orderNumber)}</strong> has been delivered successfully.`;
  }
}

function roleText(data: OrderDeliveredEmailData): string {
  switch (data.role) {
    case "DELIVERY_PARTNER":
      return `You have completed delivery of order ${data.orderNumber}.`;
    case "SELLER":
      return `Order ${data.orderNumber} has been marked as delivered.`;
    default:
      return `Your order ${data.orderNumber} has been delivered successfully.`;
  }
}

export function renderOrderDeliveredEmail(
  data: OrderDeliveredEmailData,
): RenderedEmail {
  const isPartner = data.role === "DELIVERY_PARTNER";
  const html = renderEmailLayout({
    title: isPartner ? "Delivery completed" : "Order delivered",
    preheader: isPartner
      ? `Delivery of order ${data.orderNumber} is complete.`
      : `Order ${data.orderNumber} has been delivered.`,
    bodyHtml: `<p>${escapeHtml(greeting(data.recipientName))}</p>
      <p>${roleMessage(data)}</p>
      <p>Thank you for using the VitalNode Marketplace.</p>`,
    ctaLabel: data.orderUrl ? "View order" : undefined,
    ctaUrl: data.orderUrl,
  });

  const text = [
    greeting(data.recipientName),
    "",
    roleText(data),
    data.orderUrl ? `View order: ${data.orderUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: isPartner ? "Delivery completed" : EMAIL_SUBJECTS.ORDER_DELIVERED,
    html,
    text,
  };
}
