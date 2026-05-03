// Email queue — delivers transactional emails (magic-link, reset, invite, alerts)
import { Job } from 'bullmq';
import { sendEmail } from '@claw/mailer';

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  type: 'magic-link' | 'password-reset' | 'invite' | 'alert';
}

export async function processJob(job: Job<EmailJobData>): Promise<void> {
  const { to, subject, html } = job.data;
  await sendEmail({ to, subject, html });
  console.log(`Email sent to ${to}: ${subject}`);
}
