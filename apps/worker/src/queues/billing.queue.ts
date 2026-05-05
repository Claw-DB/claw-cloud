import { JOB_NAMES, QUEUE_NAMES } from '@claw/common';
import { type QueueJob, type QueueDefinition } from './types.js';

export interface BillingJobData {
  workspaceId: string;
  period: string;
}

export const billingQueue: QueueDefinition = {
  name: QUEUE_NAMES.BILLING,
  workerOptions: {
    concurrency: 2,
    limiter: { max: 8, duration: 1000 },
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 30 * 86400, count: 5000 },
  },
  registerSchedules: async (queue) => {
    await queue.upsertJobScheduler(JOB_NAMES.FLUSH_USAGE, { every: 60_000 });
    await queue.upsertJobScheduler(JOB_NAMES.STORAGE_SNAPSHOT, { every: 60 * 60 * 1000 });
    await queue.upsertJobScheduler(JOB_NAMES.BILLING_PERIOD, { pattern: '0 0 1 * *' });
  },
  createProcessor: ({ prisma, redis }) => async (job: QueueJob<BillingJobData>) => {
    if (job.name === JOB_NAMES.FLUSH_USAGE) {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'cloud:usage:*', 'COUNT', '100');
        cursor = nextCursor;

        for (const key of keys) {
          const values = await redis.hgetall(key);
          const [, , workspaceId, instanceId, period] = key.split(':');
          const periodDate = new Date(`${period}-01T00:00:00.000Z`);

          await prisma.usageRecord.upsert({
            where: { workspaceId_instanceId_period: { workspaceId, instanceId, period: periodDate } },
            create: {
              workspaceId,
              instanceId,
              period: periodDate,
              memoryOpsCount: BigInt(Number(values.memoryOpsCount ?? 0)),
              storageGbHours: Number(values.storageGbHours ?? 0),
              vectorOpsCount: BigInt(Number(values.vectorOpsCount ?? 0)),
              syncOpsCount: BigInt(Number(values.syncOpsCount ?? 0)),
              bandwidthGb: Number(values.bandwidthGb ?? 0),
              reflectJobsCount: Number(values.reflectJobsCount ?? 0),
              computeMinutes: Number(values.computeMinutes ?? 0),
            },
            update: {
              memoryOpsCount: { increment: BigInt(Number(values.memoryOpsCount ?? 0)) },
              storageGbHours: { increment: Number(values.storageGbHours ?? 0) },
              vectorOpsCount: { increment: BigInt(Number(values.vectorOpsCount ?? 0)) },
              syncOpsCount: { increment: BigInt(Number(values.syncOpsCount ?? 0)) },
              bandwidthGb: { increment: Number(values.bandwidthGb ?? 0) },
              reflectJobsCount: { increment: Number(values.reflectJobsCount ?? 0) },
              computeMinutes: { increment: Number(values.computeMinutes ?? 0) },
            },
          });

          await redis.del(key);
        }
      } while (cursor !== '0');

      return;
    }

    if (job.name === JOB_NAMES.STORAGE_SNAPSHOT) {
      const instances = await prisma.instance.findMany({ where: { status: 'RUNNING' } });
      const period = new Date().toISOString().slice(0, 7);
      const pipeline = redis.multi();

      for (const instance of instances) {
        const usageKey = `cloud:usage:${instance.workspaceId}:${instance.id}:${period}`;
        pipeline.hincrbyfloat(usageKey, 'storageGbHours', instance.storageGb);
        pipeline.hincrbyfloat(usageKey, 'computeMinutes', 60);
      }

      await pipeline.exec();
      return;
    }

    // Lemon billing does not use Stripe metered-usage reporting.
    // Usage is still persisted and billed from internal usage records.
    void job.data.period;
  },
};
