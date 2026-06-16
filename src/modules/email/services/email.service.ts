import { env } from "../../../config/env.js";
import {
  emailClient,
  isSesConfigured,
  type SendEmailInput,
} from "../../../infrastructure/email/index.js";
import { logger } from "../../../infrastructure/logger/logger.js";
import { AppError } from "../../../shared/errors/app.errors.js";
import { EMAIL_TEMPLATE_IDS } from "../constants/email.constants.js";
import type {
  DeliveryAssignedEmailData,
  OrderCancelledEmailData,
  OrderDeliveredEmailData,
  OrderPlacedEmailData,
  PasswordResetEmailData,
  ProductApprovedEmailData,
  ProductRejectedEmailData,
  SellerApprovedEmailData,
  SellerRejectedEmailData,
} from "../types/email.types.js";
import { templateService } from "./template.service.js";

export class EmailService {
  isConfigured(): boolean {
    return isSesConfigured();
  }

  async sendEmail(input: SendEmailInput): Promise<{ messageId: string }> {
    this.assertConfigured();

    try {
      return await emailClient.send(input);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error({ err: error, to: input.to, subject: input.subject }, "Email delivery failed");
      throw new AppError("Failed to send email", 502, "EMAIL_SEND_FAILED");
    }
  }

  async sendPasswordResetEmail(
    to: string,
    data: PasswordResetEmailData,
  ): Promise<{ messageId: string }> {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.PASSWORD_RESET, data);
    return this.sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  async sendSellerApprovedEmail(
    to: string,
    data: SellerApprovedEmailData,
  ): Promise<{ messageId: string }> {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.SELLER_APPROVED, data);
    return this.sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  async sendSellerRejectedEmail(
    to: string,
    data: SellerRejectedEmailData,
  ): Promise<{ messageId: string }> {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.SELLER_REJECTED, data);
    return this.sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  async sendProductApprovedEmail(
    to: string,
    data: ProductApprovedEmailData,
  ): Promise<{ messageId: string }> {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.PRODUCT_APPROVED, data);
    return this.sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  async sendProductRejectedEmail(
    to: string,
    data: ProductRejectedEmailData,
  ): Promise<{ messageId: string }> {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.PRODUCT_REJECTED, data);
    return this.sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  async sendOrderPlacedEmail(
    to: string,
    data: OrderPlacedEmailData,
  ): Promise<{ messageId: string }> {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.ORDER_PLACED, data);
    return this.sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  async sendOrderCancelledEmail(
    to: string,
    data: OrderCancelledEmailData,
  ): Promise<{ messageId: string }> {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.ORDER_CANCELLED, data);
    return this.sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  async sendDeliveryAssignedEmail(
    to: string,
    data: DeliveryAssignedEmailData,
  ): Promise<{ messageId: string }> {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.DELIVERY_ASSIGNED, data);
    return this.sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  async sendOrderDeliveredEmail(
    to: string,
    data: OrderDeliveredEmailData,
  ): Promise<{ messageId: string }> {
    const rendered = templateService.render(EMAIL_TEMPLATE_IDS.ORDER_DELIVERED, data);
    return this.sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  private assertConfigured(): void {
    if (!isSesConfigured()) {
      throw new AppError("Email service is not configured", 503, "EMAIL_NOT_CONFIGURED");
    }
  }
}

export const emailService = new EmailService();

export function buildAppUrl(pathname: string): string | undefined {
  if (!env.webAppBaseUrl) {
    return undefined;
  }

  return new URL(pathname, env.webAppBaseUrl).toString();
}

export function buildRecipientName(
  firstName?: string | null,
  lastName?: string | null,
): string | undefined {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || undefined;
}
