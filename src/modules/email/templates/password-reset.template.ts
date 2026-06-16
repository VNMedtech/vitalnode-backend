import { EMAIL_SUBJECTS } from "../constants/email.constants.js";
import type { PasswordResetEmailData, RenderedEmail } from "../types/email.types.js";
import { escapeHtml, greeting, renderEmailLayout } from "./layout.template.js";

export function renderPasswordResetEmail(data: PasswordResetEmailData): RenderedEmail {
  const actionBlock = data.resetLink
    ? `<p>Click the button below to choose a new password. This link expires in <strong>${data.expiresInMinutes} minutes</strong>.</p>`
    : `<p>Use the reset token below to choose a new password. This token expires in <strong>${data.expiresInMinutes} minutes</strong>.</p>
       <p style="font-family: monospace; font-size: 16px; background: #f3f4f6; padding: 12px; border-radius: 6px;">${escapeHtml(data.resetToken ?? "")}</p>`;

  const html = renderEmailLayout({
    title: "Reset your password",
    preheader: "Use this email to reset your marketplace account password.",
    bodyHtml: `<p>${escapeHtml(greeting(data.recipientName))}</p>
      <p>We received a request to reset the password for your account.</p>
      ${actionBlock}
      <p>If you did not request this, you can safely ignore this email.</p>`,
    ctaLabel: data.resetLink ? "Reset password" : undefined,
    ctaUrl: data.resetLink,
  });

  const text = [
    greeting(data.recipientName),
    "",
    "We received a request to reset the password for your account.",
    data.resetLink
      ? `Reset your password using this link (expires in ${data.expiresInMinutes} minutes): ${data.resetLink}`
      : `Reset token (expires in ${data.expiresInMinutes} minutes): ${data.resetToken ?? ""}`,
    "",
    "If you did not request this, you can safely ignore this email.",
  ].join("\n");

  return {
    subject: EMAIL_SUBJECTS.PASSWORD_RESET,
    html,
    text,
  };
}
