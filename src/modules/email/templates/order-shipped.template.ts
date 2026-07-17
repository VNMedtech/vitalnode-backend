import { EMAIL_SUBJECTS } from "../constants/email.constants.js";
import type { OrderShippedEmailData, RenderedEmail } from "../types/email.types.js";
import { escapeHtml, greeting, renderEmailLayout } from "./layout.template.js";

function roleMessage(data: OrderShippedEmailData): string {
  if (data.role === "SELLER") {
    return `Order <strong>${escapeHtml(data.orderNumber)}</strong> has been marked as shipped.`;
  }
  return `Your order <strong>${escapeHtml(data.orderNumber)}</strong> has been shipped.`;
}

function trackingDetailsHtml(data: OrderShippedEmailData): string {
  const rows: string[] = [
    `<p><strong>Track shipment:</strong> <a href="${escapeHtml(data.trackingUrl)}">${escapeHtml(data.trackingUrl)}</a></p>`,
  ];
  if (data.carrier) {
    rows.push(`<p><strong>Carrier:</strong> ${escapeHtml(data.carrier)}</p>`);
  }
  if (data.awbNumber) {
    rows.push(
      `<p><strong>AWB / tracking number:</strong> ${escapeHtml(data.awbNumber)}</p>`,
    );
  }
  return rows.join("\n      ");
}

export function renderOrderShippedEmail(
  data: OrderShippedEmailData,
): RenderedEmail {
  const html = renderEmailLayout({
    title: "Order shipped",
    preheader: `Order ${data.orderNumber} has been shipped.`,
    bodyHtml: `<p>${escapeHtml(greeting(data.recipientName))}</p>
      <p>${roleMessage(data)}</p>
      ${trackingDetailsHtml(data)}`,
    ctaLabel: "Track shipment",
    ctaUrl: data.trackingUrl,
  });

  const text = [
    greeting(data.recipientName),
    "",
    data.role === "SELLER"
      ? `Order ${data.orderNumber} has been marked as shipped.`
      : `Your order ${data.orderNumber} has been shipped.`,
    `Track shipment: ${data.trackingUrl}`,
    data.carrier ? `Carrier: ${data.carrier}` : "",
    data.awbNumber ? `AWB / tracking number: ${data.awbNumber}` : "",
    data.orderUrl ? `View order: ${data.orderUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: EMAIL_SUBJECTS.ORDER_SHIPPED,
    html,
    text,
  };
}
