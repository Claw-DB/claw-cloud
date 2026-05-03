// BullMQ worker bootstrap — initializes all queue processors and connects to Redis
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const QUEUES = [
  'provision',
  'billing',
  'backup',
  'replication',
  'email',
  'cleanup',
] as const;

type QueueName = (typeof QUEUES)[number];

// Initialize workers for each queue
const workers: Worker[] = QUEUES.map((name) => {
  const worker = new Worker(
    name,
    async (job) => {
      console.log(`[${name}] Processing job ${job.id}: ${job.name}`);
      // Each queue imports its own processor dynamically
      const { processJob } = await import(`./queues/${name}.queue.js`);
      return processJob(job);
    },
    { connection },
  );

  worker.on('completed', (job) => console.log(`[${name}] Job ${job.id} completed`));
  worker.on('failed', (job, err) => console.error(`[${name}] Job ${job?.id} failed:`, err));

  return worker;
});

console.log(`🚀 Worker started — listening on queues: ${QUEUES.join(', ')}`);

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down workers...');
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
