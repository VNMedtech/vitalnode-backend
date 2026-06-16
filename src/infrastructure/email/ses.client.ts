/**
 * AWS SES client — low-level SDK wrapper for transactional email delivery.
 */
import {
  SESClient,
  SendEmailCommand,
  type SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import { AppError } from "../../shared/errors/app.errors.js";
import { logger } from "../logger/logger.js";
import {
  formatSesFromAddress,
  isSesConfigured,
  sesConfig,
} from "./ses.config.js";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

let cachedClient: SESClient | null = null;

export function getSesClient(): SESClient {
  if (!isSesConfigured()) {
    throw new AppError(
      "Email service is not configured",
      503,
      "EMAIL_NOT_CONFIGURED",
    );
  }

  if (!cachedClient) {
    cachedClient = new SESClient({
      region: sesConfig.region,
      credentials: {
        accessKeyId: sesConfig.accessKeyId,
        secretAccessKey: sesConfig.secretAccessKey,
      },
    });
  }

  return cachedClient;
}

export function resetSesClientForTests(): void {
  cachedClient = null;
}

function normalizeRecipients(to: string | string[]): string[] {
  const recipients = Array.isArray(to) ? to : [to];
  const normalized = recipients.map((address) => address.trim()).filter(Boolean);

  if (normalized.length === 0) {
    throw new AppError("Email recipient is required", 400, "EMAIL_INVALID_RECIPIENT");
  }

  return normalized;
}

function mapSesError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : "Unknown email delivery error";
  const name = error instanceof Error ? error.name : "SesError";

  logger.error({ err: error, provider: "aws-ses", errorName: name }, "SES send failed");

  return new AppError(`Failed to send email: ${message}`, 502, "EMAIL_SEND_FAILED");
}

export class SesEmailClient {
  async send(input: SendEmailInput): Promise<{ messageId: string }> {
    const destinations = normalizeRecipients(input.to);
    const textBody = input.text?.trim() || stripHtmlToText(input.html);
    const replyTo = input.replyTo?.trim() || sesConfig.replyToEmail || undefined;

    const commandInput: SendEmailCommandInput = {
      Source: formatSesFromAddress(),
      Destination: {
        ToAddresses: destinations,
      },
      Message: {
        Subject: {
          Charset: "UTF-8",
          Data: input.subject,
        },
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: input.html,
          },
          Text: {
            Charset: "UTF-8",
            Data: textBody,
          },
        },
      },
      ...(replyTo
        ? {
            ReplyToAddresses: [replyTo],
          }
        : {}),
    };

    try {
      const client = getSesClient();
      const response = await client.send(new SendEmailCommand(commandInput));
      const messageId = response.MessageId ?? "unknown";

      logger.info(
        {
          to: destinations,
          subject: input.subject,
          messageId,
          provider: "aws-ses",
        },
        "Email sent",
      );

      return { messageId };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw mapSesError(error);
    }
  }
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const sesEmailClient = new SesEmailClient();
