import { Injectable, NotFoundException } from '@nestjs/common';
import { Webhook, WebhookDelivery } from '@prisma/client';
import crypto from 'node:crypto';
import { CreateWebhookDtoType, JOB_NAMES, QUEUE_NAMES, UpdateWebhookDtoType, WEBHOOK_SECRET_BYTES } from '@claw/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getQueue } from '../../common/infra/queue.js';

@Injectable()
export class WebhooksService {
  private readonly webhookQueue = getQueue(QUEUE_NAMES.WEBHOOK);

  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateWebhookDtoType): Promise<Webhook & { secret: string }> {
    const secret = crypto.randomBytes(WEBHOOK_SECRET_BYTES).toString('hex');
    const secretHash = this.hashSecret(secret);
    const webhook = await this.prisma.webhook.create({
      data: {
        workspaceId,
        url: dto.url,
        events: dto.events,
        enabled: dto.enabled,
        secretHash,
      },
    });

    return { ...webhook, secret };
  }

  async list(workspaceId: string) {
    return this.prisma.webhook.findMany({
      where: { workspaceId },
      orderBy: { lastDeliveryAt: 'desc' },
    });
  }

  async update(id: string, workspaceId: string, dto: UpdateWebhookDtoType) {
    await this.findWebhook(id, workspaceId);
    return this.prisma.webhook.update({
      where: { id },
      data: {
        url: dto.url,
        events: dto.events,
        enabled: dto.enabled,
      },
    });
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    await this.findWebhook(id, workspaceId);
    await this.prisma.webhook.delete({ where: { id } });
  }

  async rotateSecret(id: string, workspaceId: string) {
    await this.findWebhook(id, workspaceId);
    const secret = crypto.randomBytes(WEBHOOK_SECRET_BYTES).toString('hex');
    await this.prisma.webhook.update({
      where: { id },
      data: { secretHash: this.hashSecret(secret) },
    });
    return { secret };
  }

  async deliver(workspaceId: string, event: string, payload: object): Promise<void> {
    const hooks = await this.prisma.webhook.findMany({
      where: { workspaceId, enabled: true, events: { has: event } },
    });

    for (const webhook of hooks) {
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          workspaceId,
          event,
          payload,
          status: 'PENDING',
        },
      });
      await this.webhookQueue.add(JOB_NAMES.WEBHOOK_DELIVERY, {
        workspaceId,
        webhookId: webhook.id,
        deliveryId: delivery.id,
      });
    }
  }

  async redeliver(deliveryId: string): Promise<WebhookDelivery> {
    const delivery = await this.prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) {
      throw new NotFoundException('Webhook delivery not found');
    }

    await this.webhookQueue.add(JOB_NAMES.WEBHOOK_DELIVERY, {
      workspaceId: delivery.workspaceId,
      webhookId: delivery.webhookId,
      deliveryId,
    });

    return delivery;
  }

  private async findWebhook(id: string, workspaceId: string) {
    const webhook = await this.prisma.webhook.findFirst({ where: { id, workspaceId } });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    return webhook;
  }

  private hashSecret(secret: string) {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }
}