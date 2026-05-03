// Transactional email module — sends emails via Resend API for auth, billing, and alerts
import { Resend } from 'resend';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[mailer] RESEND_API_KEY not set — email not sent:', payload.subject);
    return;
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: payload.from ?? 'Claw Cloud <noreply@claw.cloud>',
    to: Array.isArray(payload.to) ? payload.to : [payload.to],
    subject: payload.subject,
    html: payload.html,
  });
}

export { Resend };
