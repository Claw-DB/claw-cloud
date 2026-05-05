import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationType, Prisma } from '@prisma/client';

interface SseClient {
  userId: string;
  res: Response;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly clients = new Map<string, SseClient[]>();

  constructor(private readonly prisma: PrismaService) {}

  // ── SSE Connection management ──────────────────────────────────────────────

  addClient(userId: string, res: Response): () => void {
    const client: SseClient = { userId, res };
    const existing = this.clients.get(userId) ?? [];
    this.clients.set(userId, [...existing, client]);

    this.logger.debug(`SSE client connected: ${userId} (${this.clients.size} total users)`);

    // Send initial ping so the client knows the connection is alive
    res.write(`event: ping\ndata: {}\n\n`);

    const cleanup = () => {
      const remaining = (this.clients.get(userId) ?? []).filter((c) => c !== client);
      if (remaining.length === 0) {
        this.clients.delete(userId);
      } else {
        this.clients.set(userId, remaining);
      }
      this.logger.debug(`SSE client disconnected: ${userId}`);
    };

    return cleanup;
  }

  // ── Push a notification to a user ─────────────────────────────────────────

  async push(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    workspaceId: string,
    meta?: Prisma.InputJsonValue,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        workspaceId,
        type,
        title,
        body,
        metadata: meta ?? ({} as Prisma.InputJsonValue),
        read: false,
      },
    });

    this.sendToUser(userId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      read: notification.read,
      createdAt: notification.createdAt,
    });

    return notification;
  }

  private sendToUser(userId: string, payload: unknown) {
    const userClients = this.clients.get(userId) ?? [];
    const data = `data: ${JSON.stringify(payload)}\n\n`;

    for (const client of userClients) {
      try {
        client.res.write(data);
      } catch {
        // Connection closed, will be cleaned up on 'close' event
      }
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async list(userId: string, workspaceId?: string) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(workspaceId ? { workspaceId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string, workspaceId?: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
        ...(workspaceId ? { workspaceId } : {}),
      },
      data: { read: true },
    });
  }

  async unreadCount(userId: string, workspaceId?: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        read: false,
        ...(workspaceId ? { workspaceId } : {}),
      },
    });
  }
}
