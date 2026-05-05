import { JOB_NAMES, QUEUE_NAMES } from '@claw/common';
import { mailerService, type MailTemplateName } from '@claw/mailer';
import { type QueueJob, type QueueDefinition } from './types.js';

export interface EmailJobData {
  to?: string | string[];
  template?: MailTemplateName;
  variables?: Record<string, unknown>;
  subject?: string;
  html?: string;
  workspaceId?: string;
  invitationId?: string;
  invoiceId?: string;
}

function templateFromJobName(name: string): MailTemplateName {
  switch (name) {
    case JOB_NAMES.WELCOME_EMAIL:
      return 'welcome';
    case JOB_NAMES.INVITATION_EMAIL:
      return 'invitation';
    case JOB_NAMES.PASSWORD_RESET_EMAIL:
      return 'password-reset';
    case JOB_NAMES.DUNNING_EMAIL:
      return 'dunning';
    case JOB_NAMES.RECEIPT_EMAIL:
      return 'invoice';
    default:
      return 'instance-alert';
  }
}

export const emailQueue: QueueDefinition = {
  name: QUEUE_NAMES.EMAIL,
  workerOptions: {
    concurrency: 20,
    limiter: { max: 50, duration: 1000 },
  },
  defaultJobOptions: {
    attempts: 8,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 86400, count: 3000 },
    removeOnFail: { age: 14 * 86400, count: 5000 },
  },
  createProcessor: ({ prisma }) => async (job: QueueJob<EmailJobData>) => {
    let recipient = job.data.to;
    if (!recipient && job.data.workspaceId) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: job.data.workspaceId },
        include: { owner: true },
      });
      recipient = workspace?.owner.email;
    }
    if (!recipient) {
      return;
    }

    if (job.data.template) {
      await mailerService.send(recipient, job.data.template, job.data.variables ?? {});
      return;
    }

    if (job.data.subject && job.data.html) {
      // Legacy support: custom payloads can still send raw html.
      const { sendEmail } = await import('@claw/mailer');
      await sendEmail({
        to: recipient,
        subject: job.data.subject,
        html: job.data.html,
      });
      return;
    }

    await mailerService.send(recipient, templateFromJobName(job.name), job.data.variables ?? {});
  },
};
