import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReplicationLink, ReplicationStatus } from '@prisma/client';
import { CreateReplicationLinkDtoType, JOB_NAMES, QUEUE_NAMES } from '@claw/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getQueue } from '../../common/infra/queue.js';

@Injectable()
export class ReplicationService {
  private readonly replicationQueue = getQueue(QUEUE_NAMES.REPLICATION);

  constructor(private readonly prisma: PrismaService) {}

  async createLink(
    sourceInstanceId: string,
    targetInstanceId: string,
    workspaceId: string,
  ): Promise<ReplicationLink> {
    if (sourceInstanceId === targetInstanceId) {
      throw new ConflictException('Source and target instances must be different');
    }

    const [source, target] = await Promise.all([
      this.prisma.instance.findFirst({ where: { id: sourceInstanceId, workspaceId } }),
      this.prisma.instance.findFirst({ where: { id: targetInstanceId, workspaceId } }),
    ]);
    if (!source || !target) {
      throw new NotFoundException('Both instances must belong to the workspace');
    }

    const existing = await this.prisma.replicationLink.findFirst({
      where: { sourceInstanceId, targetInstanceId },
    });
    if (existing) {
      throw new ConflictException('Replication link already exists');
    }

    const link = await this.prisma.replicationLink.create({
      data: {
        sourceInstanceId,
        targetInstanceId,
        region: target.region,
        status: 'ACTIVE',
      },
    });

    await this.replicationQueue.add(JOB_NAMES.CONFIGURE_SYNC, {
      linkId: link.id,
      sourceInstanceId,
      targetInstanceId,
      workspaceId,
    });

    return link;
  }

  async deleteLink(linkId: string, workspaceId: string): Promise<void> {
    const link = await this.findLink(linkId, workspaceId);
    await this.prisma.replicationLink.delete({ where: { id: link.id } });
    await this.replicationQueue.add(JOB_NAMES.DECONFIGURE_SYNC, {
      linkId,
      sourceInstanceId: link.sourceInstanceId,
      targetInstanceId: link.targetInstanceId,
      workspaceId,
    });
  }

  async pauseLink(linkId: string, workspaceId: string): Promise<ReplicationLink> {
    await this.findLink(linkId, workspaceId);
    return this.prisma.replicationLink.update({
      where: { id: linkId },
      data: { status: 'PAUSED' },
    });
  }

  async resumeLink(linkId: string, workspaceId: string): Promise<ReplicationLink> {
    await this.findLink(linkId, workspaceId);
    return this.prisma.replicationLink.update({
      where: { id: linkId },
      data: { status: 'ACTIVE' },
    });
  }

  async getStatus(linkId: string, workspaceId: string) {
    const link = await this.findLink(linkId, workspaceId);
    const [source, target] = await Promise.all([
      this.prisma.instance.findUnique({ where: { id: link.sourceInstanceId } }),
      this.prisma.instance.findUnique({ where: { id: link.targetInstanceId } }),
    ]);

    const statuses = await Promise.all(
      [source, target].map(async (instance) => {
        if (!instance?.endpoint) {
          return null;
        }

        const response = await fetch(`${instance.endpoint}/sync/status`).catch(() => null);
        if (!response?.ok) {
          return null;
        }

        return response.json() as Promise<Record<string, unknown>>;
      }),
    );

    return {
      lagMs: (statuses[0]?.lagMs as number | undefined) ?? link.lagMs ?? 0,
      lastSyncAt: (statuses[0]?.lastSyncAt as string | undefined) ?? link.lastSyncAt?.toISOString(),
      pendingOps: (statuses[0]?.pendingOps as number | undefined) ?? 0,
      isSyncing: link.status === 'ACTIVE',
      source: statuses[0],
      target: statuses[1],
    };
  }

  async listLinks(workspaceId: string): Promise<ReplicationLink[]> {
    return this.prisma.replicationLink.findMany({
      where: {
        OR: [
          { sourceInstance: { workspaceId } },
          { targetInstance: { workspaceId } },
        ],
      },
      include: { sourceInstance: true, targetInstance: true },
      orderBy: { lastSyncAt: 'desc' },
    });
  }

  async pollReplicationHealth(): Promise<void> {
    const links = await this.prisma.replicationLink.findMany({
      where: { status: 'ACTIVE' },
      include: { sourceInstance: true, targetInstance: true },
    });

    for (const link of links) {
      const status = await this.getStatus(link.id, link.sourceInstance.workspaceId);
      const lagMs = Number(status.lagMs ?? 0);
      const lastSyncAt = status.lastSyncAt ? new Date(status.lastSyncAt) : null;
      let nextStatus: ReplicationStatus = 'ACTIVE';
      if (lagMs > 30_000) {
        nextStatus = 'LAGGING';
      }
      if (!lastSyncAt || Date.now() - lastSyncAt.getTime() > 5 * 60 * 1000) {
        nextStatus = 'BROKEN';
      }

      await this.prisma.replicationLink.update({
        where: { id: link.id },
        data: {
          lagMs,
          lastSyncAt,
          status: nextStatus,
        },
      });
    }
  }

  private async findLink(linkId: string, workspaceId: string) {
    const link = await this.prisma.replicationLink.findFirst({
      where: {
        id: linkId,
        sourceInstance: { workspaceId },
      },
    });
    if (!link) {
      throw new NotFoundException('Replication link not found');
    }

    return link;
  }
}