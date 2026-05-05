import { MailerService, type MailTemplateName } from './mailer.service.js';
import { getResendClient } from './resend.client.js';

const singleton = new MailerService();

export { MailerService, MailTemplateName, getResendClient };

export async function sendEmail(payload: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const resend = getResendClient();
  await resend.emails.send({
    from: 'ClawDB Cloud <noreply@clawdb.dev>',
    to: Array.isArray(payload.to) ? payload.to : [payload.to],
    reply_to: 'support@clawdb.dev',
    subject: payload.subject,
    html: payload.html,
  });
}

export const mailerService = singleton;
