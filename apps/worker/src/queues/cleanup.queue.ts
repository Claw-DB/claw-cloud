import { JOB_NAMES, QUEUE_NAMES } from '@claw/common';
import { type QueueJob, type QueueDefinition } from './types.js';

export interface CleanupJobData {
  type?: 'expired-trials' | 'orphan-resources' | 'stale-sessions';
  workspaceId?: string;
}

export const cleanupQueue: QueueDefinition = {
  name: QUEUE_NAMES.CLEANUP,
  workerOptions: {
    concurrency: 1,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 2000 },
    removeOnComplete: { age: 86400, count: 500 },
    removeOnFail: { age: 30 * 86400, count: 2000 },
  },
  registerSchedules: async (queue) => {
    await queue.upsertJobScheduler('cleanup-stale-sessions', { every: 5 * 60 * 1000 });
    await queue.upsertJobScheduler('cleanup-expired-trials', { every: 60 * 60 * 1000 });
  },
  createProcessor: ({ prisma }) => async (job: QueueJob<CleanupJobData>) => {
    const cleanupType =
      job.data.type ??
      (job.name.includes('stale-sessions')
        ? 'stale-sessions'
        : job.name.includes('expired-trials')
          ? 'expired-trials'
          : 'orphan-resources');

    if (cleanupType === 'stale-sessions') {
      await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      return;
    }

    if (cleanupType === 'expired-trials') {
      await prisma.workspace.updateMany({
        where: {
          status: 'ACTIVE',
          plan: 'FREE',
          trialEndsAt: { lt: new Date() },
        },
        data: { status: 'SUSPENDED' },
      });
      return;
    }

    if (job.data.workspaceId) {
      await prisma.instance.updateMany({
        where: {
          workspaceId: job.data.workspaceId,
          status: { not: 'TERMINATED' },
        },
        data: { status: 'TERMINATED' },
      });
    }
  },
};
