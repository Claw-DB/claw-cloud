import { JOB_NAMES, QUEUE_NAMES } from '@claw/common';
import { type QueueJob, type QueueDefinition } from './types.js';

export interface ReplicationJobData {
  linkId: string;
  sourceInstanceId: string;
  targetInstanceId: string;
  targetRegion: string;
}

export const replicationQueue: QueueDefinition = {
  name: QUEUE_NAMES.REPLICATION,
  workerOptions: {
    concurrency: 5,
    limiter: { max: 20, duration: 1000 },
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 14 * 86400, count: 5000 },
  },
  createProcessor: ({ prisma }) => async (job: QueueJob<ReplicationJobData>) => {
    if (job.name === JOB_NAMES.DECONFIGURE_SYNC) {
      await prisma.replicationLink.updateMany({
        where: { id: job.data.linkId },
        data: {
          status: 'PAUSED',
        },
      });
      return;
    }

    await prisma.replicationLink.updateMany({
      where: { id: job.data.linkId },
      data: {
        status: 'ACTIVE',
        lagMs: 0,
        lastSyncAt: new Date(),
      },
    });
  },
};
