import { EMAIL_SUBJECTS } from "../constants/email.constants.js";
import type { DeliveryAssignedEmailData, RenderedEmail } from "../types/email.types.js";
import { escapeHtml, greeting, renderEmailLayout } from "./layout.template.js";

function roleMessage(data: DeliveryAssignedEmailData): string {
  switch (data.role) {
    case "DELIVERY_PARTNER":
      return `You have been assigned to deliver order <strong>${escapeHtml(data.orderNumber)}</strong>.`;
    case "SELLER":
      return `A delivery partner has been assigned to order <strong>${escapeHtml(data.orderNumber)}</strong>.`;
    default:
      return `A delivery partner has been assigned to your order <strong>${escapeHtml(data.orderNumber)}</strong>.`;
  }
}

export function renderDeliveryAssignedEmail(
  data: DeliveryAssignedEmailData,
): RenderedEmail {
  const html = renderEmailLayout({
    title: "Delivery assigned",
    preheader: `Delivery partner assigned for order ${data.orderNumber}.`,
    bodyHtml: `<p>${escapeHtml(greeting(data.recipientName))}</p>
      <p>${roleMessage(data)}</p>
      <p>You will receive further updates as the order moves through processing and delivery.</p>`,
    ctaLabel: data.deliveryUrl ? "View delivery" : undefined,
    ctaUrl: data.deliveryUrl,
  });

  const text = [
    greeting(data.recipientName),
    "",
    data.role === "DELIVERY_PARTNER"
      ? `You have been assigned to deliver order ${data.orderNumber}.`
      : data.role === "SELLER"
        ? `A delivery partner has been assigned to order ${data.orderNumber}.`
        : `A delivery partner has been assigned to your order ${data.orderNumber}.`,
    data.deliveryUrl ? `View delivery: ${data.deliveryUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: EMAIL_SUBJECTS.DELIVERY_ASSIGNED,
    html,
    text,
  };
}
