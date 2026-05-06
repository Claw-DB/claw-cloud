import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Webhook, WebhookDelivery } from '@prisma/client';
import crypto from 'node:crypto';
import net from 'node:net';
import { CreateWebhookDtoType, JOB_NAMES, QUEUE_NAMES, UpdateWebhookDtoType, WEBHOOK_SECRET_BYTES } from '@claw/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getQueue } from '../../common/infra/queue.js';

@Injectable()
export class WebhooksService {
  private readonly webhookQueue = getQueue(QUEUE_NAMES.WEBHOOK);

  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateWebhookDtoType): Promise<Webhook & { secret: string }> {
    const validatedUrl = this.validateWebhookUrl(dto.url);
    const secret = this.generateWebhookSecret();
    const webhook = await this.prisma.webhook.create({
      data: {
        workspaceId,
        url: validatedUrl,
        events: dto.events,
        enabled: dto.enabled,
        secretHash: secret,
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
    const validatedUrl = dto.url ? this.validateWebhookUrl(dto.url) : undefined;
    return this.prisma.webhook.update({
      where: { id },
      data: {
        url: validatedUrl,
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
    const secret = this.generateWebhookSecret();
    await this.prisma.webhook.update({
      where: { id },
      data: { secretHash: secret },
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

  private generateWebhookSecret() {
    return crypto.randomBytes(WEBHOOK_SECRET_BYTES).toString('base64url');
  }

  private validateWebhookUrl(rawUrl: string) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BadRequestException('Webhook URL is invalid');
    }

    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new BadRequestException('Webhook URL protocol must be http or https');
    }

    if (process.env.NODE_ENV === 'production' && protocol !== 'https:') {
      throw new BadRequestException('Webhook URL must use HTTPS in production');
    }

    const host = parsed.hostname.toLowerCase();
    const blockedHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
    if (blockedHosts.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
      throw new BadRequestException('Webhook URL host is not allowed');
    }

    if (net.isIP(host) && this.isPrivateIp(host)) {
      throw new BadRequestException('Webhook URL cannot target private network addresses');
    }

    return parsed.toString();
  }

  private isPrivateIp(host: string) {
    const ipVersion = net.isIP(host);
    if (ipVersion === 4) {
      const [a, b] = host.split('.').map(Number);
      return (
        a === 10
        || a === 127
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168)
      );
    }

    if (ipVersion === 6) {
      const normalized = host.toLowerCase();
      return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80');
    }

    return false;
  }
}