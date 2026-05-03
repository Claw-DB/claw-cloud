import crypto from 'node:crypto';
import { JOB_NAMES, QUEUE_NAMES } from '@claw/common';
import { type QueueJob, type QueueDefinition } from './types.js';

interface WebhookJobData {
  workspaceId: string;
  webhookId: string;
  deliveryId: string;
}

export const webhookQueue: QueueDefinition = {
  name: QUEUE_NAMES.WEBHOOK,
  workerOptions: {
    concurrency: 24,
    limiter: { max: 200, duration: 1000 },
  },
  defaultJobOptions: {
    attempts: 10,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 86400, count: 3000 },
    removeOnFail: { age: 30 * 86400, count: 10000 },
  },
  createProcessor: ({ prisma }) => async (job: QueueJob<WebhookJobData>) => {
    if (job.name !== JOB_NAMES.WEBHOOK_DELIVERY) {
      return;
    }

    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: job.data.deliveryId },
      include: { webhook: true },
    });
    if (!delivery) {
      return;
    }

    const body = JSON.stringify({
      id: delivery.id,
      event: delivery.event,
      created_at: delivery.createdAt,
      workspace_id: delivery.workspaceId,
      data: delivery.payload,
    });
    const signature = crypto
      .createHmac('sha256', delivery.webhook.secretHash)
      .update(body)
      .digest('hex');

    const response = await fetch(delivery.webhook.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-claw-signature': `sha256=${signature}`,
      },
      body,
    });

    const responseBody = await response.text();
    const success = response.ok;

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: success ? 'DELIVERED' : 'FAILED',
        attemptCount: { increment: 1 },
        responseStatus: response.status,
        responseBody,
        deliveredAt: success ? new Date() : null,
        lastAttemptAt: new Date(),
      },
    });

    await prisma.webhook.update({
      where: { id: delivery.webhookId },
      data: {
        lastDeliveryAt: new Date(),
        lastDeliveryStatus: success ? 'DELIVERED' : 'FAILED',
      },
    });

    if (!success) {
      throw new Error(`Webhook delivery failed with status ${response.status}`);
    }
  },
};
