export { emailClient, EmailClient } from "./email.client.js";
export { emailTemplates } from "./email.templates.js";
export {
  getSesClient,
  resetSesClientForTests,
  sesEmailClient,
  SesEmailClient,
  type SendEmailInput,
} from "./ses.client.js";
export {
  formatSesFromAddress,
  isSesConfigured,
  sesConfig,
} from "./ses.config.js";
