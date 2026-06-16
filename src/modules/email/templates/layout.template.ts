import { EMAIL_BRAND } from "../constants/email.constants.js";

export interface EmailLayoutOptions {
  title: string;
  preheader?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export function renderEmailLayout(options: EmailLayoutOptions): string {
  const { title, preheader, bodyHtml, ctaLabel, ctaUrl } = options;
  const ctaBlock =
    ctaLabel && ctaUrl
      ? `<p style="margin: 24px 0;">
          <a href="${escapeHtml(ctaUrl)}" style="display: inline-block; background-color: #0f766e; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 600;">
            ${escapeHtml(ctaLabel)}
          </a>
        </p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f7f6; font-family: Arial, Helvetica, sans-serif; color: #1f2937;">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ""}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f7f6; padding: 24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);">
            <tr>
              <td style="background-color: #0f766e; color: #ffffff; padding: 20px 28px; font-size: 18px; font-weight: 700;">
                ${escapeHtml(EMAIL_BRAND.name)}
              </td>
            </tr>
            <tr>
              <td style="padding: 28px;">
                <h1 style="margin: 0 0 16px; font-size: 22px; line-height: 1.3; color: #111827;">${escapeHtml(title)}</h1>
                <div style="font-size: 15px; line-height: 1.6; color: #374151;">
                  ${bodyHtml}
                </div>
                ${ctaBlock}
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 28px 24px; font-size: 12px; line-height: 1.5; color: #6b7280; border-top: 1px solid #e5e7eb;">
                This is an automated message from ${escapeHtml(EMAIL_BRAND.name)}.
                If you need help, contact ${escapeHtml(EMAIL_BRAND.supportEmail)}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function greeting(name?: string): string {
  return name?.trim() ? `Hello ${name.trim()},` : "Hello,";
}
