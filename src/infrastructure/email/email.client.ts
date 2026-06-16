/**
 * Email delivery client — backward-compatible facade over AWS SES.
 */
import { sesEmailClient, type SendEmailInput } from "./ses.client.js";

export type { SendEmailInput };

export class EmailClient {
  async send(input: SendEmailInput): Promise<{ messageId: string }> {
    return sesEmailClient.send(input);
  }
}

export const emailClient = new EmailClient();
