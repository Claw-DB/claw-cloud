import { Injectable } from '@nestjs/common';
import { Prisma, ReplicationStatus, SubscriptionStatus, WorkspaceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

interface Pagination {
  page: number;
  limit: number;
}

interface WorkspaceFilters extends Pagination {
  search?: string;
  status?: WorkspaceStatus;
  plan?: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
}

interface InstanceFilters extends Pagination {
  status?:
    | 'PROVISIONING'
    | 'RUNNING'
    | 'SCALING'
    | 'PAUSED'
    | 'TERMINATING'
    | 'TERMINATED'
    | 'ERROR';
  region?: 'US_EAST' | 'US_WEST' | 'EU_WEST' | 'EU_CENTRAL' | 'APAC_EAST';
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async suspendWorkspace(workspaceId: string) {
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { status: 'SUSPENDED' },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async reactivateWorkspace(workspaceId: string) {
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { status: 'ACTIVE' },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async getOverview() {
    const [
      totalWorkspaces,
      activeWorkspaces,
      totalInstances,
      runningInstances,
      failedDeliveries,
      pastDueSubscriptions,
      laggingLinks,
      brokenLinks,
    ] = await Promise.all([
      this.prisma.workspace.count(),
      this.prisma.workspace.count({ where: { status: 'ACTIVE' } }),
      this.prisma.instance.count(),
      this.prisma.instance.count({ where: { status: 'RUNNING' } }),
      this.prisma.webhookDelivery.count({ where: { status: 'FAILED' } }),
      this.prisma.billingSubscription.count({ where: { status: 'PAST_DUE' } }),
      this.prisma.replicationLink.count({ where: { status: 'LAGGING' } }),
      this.prisma.replicationLink.count({ where: { status: 'BROKEN' } }),
    ]);

    return {
      totals: {
        workspaces: totalWorkspaces,
        activeWorkspaces,
        instances: totalInstances,
        runningInstances,
      },
      health: {
        failedWebhookDeliveries: failedDeliveries,
        pastDueSubscriptions,
        laggingReplicationLinks: laggingLinks,
        brokenReplicationLinks: brokenLinks,
      },
      generatedAt: new Date(),
    };
  }

  async listWorkspaces(filters: WorkspaceFilters) {
    const where: Prisma.WorkspaceWhereInput = {
      status: filters.status,
      plan: filters.plan,
    };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
        { owner: { email: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.workspace.findMany({
        where,
        include: {
          owner: { select: { id: true, email: true, name: true } },
          _count: {
            select: {
              members: true,
              instances: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.workspace.count({ where }),
    ]);

    return {
      data: rows,
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    };
  }

  async listInstances(filters: InstanceFilters) {
    const where: Prisma.InstanceWhereInput = {
      status: filters.status,
      region: filters.region,
    };

    const [rows, total] = await Promise.all([
      this.prisma.instance.findMany({
        where,
        include: {
          workspace: { select: { id: true, slug: true, name: true, plan: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.instance.count({ where }),
    ]);

    return {
      data: rows,
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    };
  }

  async listIncidents(limit: number) {
    const [failedDeliveries, pastDueSubscriptions, replicationLinks] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where: { status: 'FAILED' },
        include: {
          workspace: { select: { id: true, slug: true, name: true } },
          webhook: { select: { id: true, url: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.billingSubscription.findMany({
        where: { status: 'PAST_DUE' },
        include: { workspace: { select: { id: true, slug: true, name: true } } },
        orderBy: { currentPeriodEnd: 'asc' },
        take: limit,
      }),
      this.prisma.replicationLink.findMany({
        where: { status: { in: ['LAGGING', 'BROKEN'] } },
        include: {
          sourceInstance: { select: { id: true, name: true, workspaceId: true } },
          targetInstance: { select: { id: true, name: true, workspaceId: true } },
        },
        orderBy: { lastSyncAt: 'asc' },
        take: limit,
      }),
    ]);

    const incidents = [
      ...failedDeliveries.map((row) => ({
        id: `webhook:${row.id}`,
        severity: 'warning' as const,
        type: 'webhook_delivery_failed' as const,
        title: 'Webhook delivery failed',
        workspace: row.workspace,
        details: {
          webhookId: row.webhookId,
          webhookUrl: row.webhook.url,
          status: row.status,
          responseStatus: row.responseStatus,
          attempts: row.attemptCount,
        },
        occurredAt: row.lastAttemptAt ?? row.createdAt,
      })),
      ...pastDueSubscriptions.map((row) => ({
        id: `billing:${row.id}`,
        severity: 'critical' as const,
        type: 'subscription_past_due' as const,
        title: 'Subscription is past due',
        workspace: row.workspace,
        details: {
          status: row.status,
          currentPeriodEnd: row.currentPeriodEnd,
          cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        },
        occurredAt: row.currentPeriodEnd ?? new Date(0),
      })),
      ...replicationLinks.map((row) => ({
        id: `replication:${row.id}`,
        severity: (row.status === 'BROKEN' ? 'critical' : 'warning') as 'critical' | 'warning',
        type: 'replication_health' as const,
        title: `Replication ${row.status.toLowerCase()}`,
        workspace: { id: row.sourceInstance.workspaceId, slug: null, name: null },
        details: {
          status: row.status,
          lagMs: row.lagMs,
          sourceInstance: row.sourceInstance,
          targetInstance: row.targetInstance,
        },
        occurredAt: row.lastSyncAt ?? new Date(0),
      })),
    ];

    incidents.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return {
      data: incidents.slice(0, limit),
      counts: {
        warning: incidents.filter((item) => item.severity === 'warning').length,
        critical: incidents.filter((item) => item.severity === 'critical').length,
      },
      generatedAt: new Date(),
    };
  }

  async listPlatformFlags() {
    const [suspendedWorkspaces, pastDueSubscriptions, laggingLinks, brokenLinks] = await Promise.all([
      this.prisma.workspace.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.billingSubscription.count({ where: { status: 'PAST_DUE' as SubscriptionStatus } }),
      this.prisma.replicationLink.count({ where: { status: 'LAGGING' as ReplicationStatus } }),
      this.prisma.replicationLink.count({ where: { status: 'BROKEN' as ReplicationStatus } }),
    ]);

    return {
      suspendedWorkspaces,
      pastDueSubscriptions,
      laggingLinks,
      brokenLinks,
      generatedAt: new Date(),
    };
  }
}
