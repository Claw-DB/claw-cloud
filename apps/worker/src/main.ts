import { NestFactory } from '@nestjs/core';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { KubeService } from '../../api/src/modules/instances/kube.service.js';
import { PrismaService } from '../../api/src/modules/prisma/prisma.service.js';
import { WorkerModule } from './worker.module.js';
import { backupQueue } from './queues/backup.queue.js';
import { billingQueue } from './queues/billing.queue.js';
import { cleanupQueue } from './queues/cleanup.queue.js';
import { emailQueue } from './queues/email.queue.js';
import { provisionQueue } from './queues/provision.queue.js';
import { replicationQueue } from './queues/replication.queue.js';
import { type QueueDefinition } from './queues/types.js';
import { webhookQueue } from './queues/webhook.queue.js';

const queueDefinitions: QueueDefinition[] = [
  provisionQueue,
  billingQueue,
  backupQueue,
  replicationQueue,
  emailQueue,
  webhookQueue,
  cleanupQueue,
];

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });

  const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  const prisma = app.get(PrismaService);
  const kube = app.get(KubeService);

  const workers: Worker[] = [];
  const queues: Queue[] = [];

  for (const definition of queueDefinitions) {
    const queue = new Queue(definition.name, {
      connection: redis,
      defaultJobOptions: definition.defaultJobOptions,
    });
    queues.push(queue);

    if (definition.registerSchedules) {
      await definition.registerSchedules(queue);
    }

    const worker = new Worker(definition.name, definition.createProcessor({ prisma, kube, redis }), {
      connection: redis,
      ...definition.workerOptions,
    });

    worker.on('completed', (job) => {
      console.log(`[${definition.name}] job ${job.id} (${job.name}) completed`);
    });
    worker.on('failed', (job, error) => {
      console.error(`[${definition.name}] job ${job?.id} (${job?.name}) failed`, error);
    });

    workers.push(worker);
  }

  const shutdown = async () => {
    await Promise.all(workers.map((worker) => worker.close()));
    await Promise.all(queues.map((queue) => queue.close()));
    await redis.quit();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Worker bootstrap failed', error);
  process.exit(1);
});
