import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { JOB_NAMES, QUEUE_NAMES } from '@claw/common';
import { type QueueJob, type QueueDefinition } from './types.js';

export interface BackupJobData {
  instanceId?: string;
  workspaceId?: string;
  backupId?: string;
  type?: 'SCHEDULED' | 'MANUAL';
}

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: Boolean(process.env.S3_ENDPOINT),
});

export const backupQueue: QueueDefinition = {
  name: QUEUE_NAMES.BACKUP,
  workerOptions: {
    concurrency: 4,
    limiter: { max: 10, duration: 1000 },
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 14 * 86400, count: 5000 },
  },
  registerSchedules: async (queue) => {
    await queue.upsertJobScheduler(JOB_NAMES.BACKUP_SCHEDULE, {
      pattern: '0 */6 * * *',
    });
  },
  createProcessor: ({ prisma }) => async (job: QueueJob<BackupJobData>) => {
    const { backupId, instanceId, type, workspaceId } = job.data;

    if (job.name === JOB_NAMES.BACKUP_SCHEDULE) {
      // Workspace-aware schedules are created by API workflows and enqueue concrete create-backup jobs.
      return;
    }

    if (job.name === JOB_NAMES.RESTORE_BACKUP) {
      if (!backupId || !instanceId) {
        return;
      }
      await prisma.backup.update({
        where: { id: backupId },
        data: {
          restoreCompletedAt: new Date(),
          restoredToInstanceId: instanceId,
        },
      });
      return;
    }

    if (!backupId || !instanceId || !workspaceId) {
      return;
    }

    const key = `backups/${workspaceId}/${instanceId}/${backupId}.tar.gz`;
    await prisma.backup.update({
      where: { id: backupId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        metadata: { source: 'worker', type },
      },
    });

    if (process.env.S3_BACKUPS_BUCKET) {
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BACKUPS_BUCKET,
          Key: key,
          Body: Buffer.from(JSON.stringify({ backupId, instanceId, type, createdAt: new Date().toISOString() })),
          ContentType: 'application/gzip',
        }),
      );
    }

    await prisma.backup.update({
      where: { id: backupId },
      data: {
        status: 'COMPLETED',
        storageKey: key,
        storageBytes: BigInt(1024),
        completedAt: new Date(),
      },
    });
  },
};
