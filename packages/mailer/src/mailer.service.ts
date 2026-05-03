import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Handlebars from 'handlebars';
import { htmlToText } from 'html-to-text';
import { getResendClient } from './resend.client.js';

export type MailTemplateName =
  | 'welcome'
  | 'invitation'
  | 'magic-link'
  | 'password-reset'
  | 'invoice'
  | 'dunning'
  | 'instance-alert'
  | 'backup-completed';

const SUBJECT_TEMPLATES: Record<MailTemplateName, string> = {
  welcome: 'Welcome to ClawDB Cloud',
  invitation: '{{inviterName}} invited you to {{workspaceName}} on ClawDB',
  'magic-link': 'Your ClawDB login link',
  'password-reset': 'Reset your ClawDB password',
  invoice: 'Your ClawDB invoice for {{month}}',
  dunning: 'Payment failed for your ClawDB subscription',
  'instance-alert': 'Alert: {{alertType}} on {{instanceName}}',
  'backup-completed': 'Backup completed for {{instanceName}}',
};

const DEFAULT_FROM = 'noreply@clawdb.io';
const DEFAULT_REPLY_TO = 'support@clawdb.io';

export class MailerService {
  private templateCache = new Map<MailTemplateName, Handlebars.TemplateDelegate>();

  async send(
    to: string | string[],
    template: MailTemplateName,
    variables: Record<string, unknown>,
  ): Promise<void> {
    const templateFn = await this.getTemplate(template);
    const bodyHtml = templateFn({
      ...variables,
      preferenceCenterUrl:
        (variables.preferenceCenterUrl as string | undefined) ??
        `${process.env.APP_URL ?? 'https://app.clawdb.io'}/settings/notifications`,
    });
    const preferenceCenterUrl =
      (variables.preferenceCenterUrl as string | undefined) ??
      `${process.env.APP_URL ?? 'https://app.clawdb.io'}/settings/notifications`;

    const html = this.wrapHtml(bodyHtml, preferenceCenterUrl);
    const text = htmlToText(html, {
      selectors: [
        { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
        { selector: 'img', format: 'skip' },
      ],
      wordwrap: 120,
    });

    const subject = Handlebars.compile(SUBJECT_TEMPLATES[template])(variables);
    const resend = getResendClient();
    await resend.emails.send({
      from: `ClawDB Cloud <${DEFAULT_FROM}>`,
      to: Array.isArray(to) ? to : [to],
      reply_to: DEFAULT_REPLY_TO,
      subject,
      html,
      text,
    });
  }

  private async getTemplate(name: MailTemplateName): Promise<Handlebars.TemplateDelegate> {
    const cached = this.templateCache.get(name);
    if (cached) {
      return cached;
    }

    const filePath = path.resolve(__dirname, 'templates', `${name}.hbs`);
    const source = await readFile(filePath, 'utf8');
    const compiled = Handlebars.compile(source);
    this.templateCache.set(name, compiled);
    return compiled;
  }

  private wrapHtml(content: string, preferenceCenterUrl: string): string {
    return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;padding:24px;box-shadow:0 1px 6px rgba(0,0,0,.08);">
            <tr>
              <td>
                ${content}
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.5;">
                You are receiving this email because you have a ClawDB Cloud account.
                <br />
                Manage preferences or unsubscribe: <a href="${preferenceCenterUrl}" style="color:#2563eb;">Notification preferences</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }
}
