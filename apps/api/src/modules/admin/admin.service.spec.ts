import { describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service.js';

function createPrismaMock() {
  return {
    workspace: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    instance: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    webhookDelivery: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    billingSubscription: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    replicationLink: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

describe('AdminService', () => {
  it('aggregates overview counters', async () => {
    const prisma = createPrismaMock();
    prisma.workspace.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(9);
    prisma.instance.count
      .mockResolvedValueOnce(21)
      .mockResolvedValueOnce(17);
    prisma.webhookDelivery.count.mockResolvedValueOnce(3);
    prisma.billingSubscription.count.mockResolvedValueOnce(2);
    prisma.replicationLink.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1);

    const service = new AdminService(prisma as never);
    const overview = await service.getOverview();

    expect(overview.totals.workspaces).toBe(12);
    expect(overview.totals.activeWorkspaces).toBe(9);
    expect(overview.totals.instances).toBe(21);
    expect(overview.totals.runningInstances).toBe(17);
    expect(overview.health.failedWebhookDeliveries).toBe(3);
    expect(overview.health.pastDueSubscriptions).toBe(2);
    expect(overview.health.laggingReplicationLinks).toBe(4);
    expect(overview.health.brokenReplicationLinks).toBe(1);
  });

  it('returns paginated workspace results', async () => {
    const prisma = createPrismaMock();
    prisma.workspace.findMany.mockResolvedValueOnce([
      {
        id: 'ws-1',
        name: 'Acme',
        slug: 'acme',
        owner: { id: 'u-1', email: 'owner@acme.io', name: 'Owner' },
        _count: { members: 3, instances: 2 },
      },
    ]);
    prisma.workspace.count.mockResolvedValueOnce(7);

    const service = new AdminService(prisma as never);
    const result = await service.listWorkspaces({
      search: 'acme',
      page: 2,
      limit: 3,
    });

    expect(prisma.workspace.findMany).toHaveBeenCalledOnce();
    expect(result.page).toBe(2);
    expect(result.limit).toBe(3);
    expect(result.total).toBe(7);
    expect(result.totalPages).toBe(3);
    expect(result.data).toHaveLength(1);
  });

  it('sorts incident feed by most recent first', async () => {
    const prisma = createPrismaMock();

    prisma.webhookDelivery.findMany.mockResolvedValueOnce([
      {
        id: 'delivery-1',
        status: 'FAILED',
        webhookId: 'hook-1',
        attemptCount: 1,
        responseStatus: 500,
        lastAttemptAt: new Date('2026-05-03T12:00:00.000Z'),
        createdAt: new Date('2026-05-03T11:00:00.000Z'),
        webhook: { id: 'hook-1', url: 'https://example.com/hook' },
        workspace: { id: 'ws-1', slug: 'acme', name: 'Acme' },
      },
    ]);

    prisma.billingSubscription.findMany.mockResolvedValueOnce([
      {
        id: 'sub-1',
        status: 'PAST_DUE',
        currentPeriodEnd: new Date('2026-05-02T00:00:00.000Z'),
        cancelAtPeriodEnd: false,
        workspace: { id: 'ws-2', slug: 'globex', name: 'Globex' },
      },
    ]);

    prisma.replicationLink.findMany.mockResolvedValueOnce([
      {
        id: 'link-1',
        status: 'BROKEN',
        lagMs: 48000,
        lastSyncAt: new Date('2026-05-03T13:00:00.000Z'),
        sourceInstance: { id: 'i-1', name: 'src', workspaceId: 'ws-1' },
        targetInstance: { id: 'i-2', name: 'dst', workspaceId: 'ws-1' },
      },
    ]);

    const service = new AdminService(prisma as never);
    const incidents = await service.listIncidents(20);

    expect(incidents.data).toHaveLength(3);
    expect(incidents.data[0].id).toBe('replication:link-1');
    expect(incidents.counts.critical).toBe(2);
    expect(incidents.counts.warning).toBe(1);
  });
});
