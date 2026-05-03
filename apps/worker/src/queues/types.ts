import type { Job, JobsOptions, Processor, Queue, WorkerOptions } from 'bullmq';
import type { PrismaService } from '../../../api/src/modules/prisma/prisma.service.js';
import type { KubeService } from '../../../api/src/modules/instances/kube.service.js';
import type IORedis from 'ioredis';

export interface WorkerContext {
  prisma: PrismaService;
  kube: KubeService;
  redis: IORedis;
}

export interface QueueDefinition {
  name: string;
  workerOptions?: Omit<WorkerOptions, 'connection'>;
  defaultJobOptions?: JobsOptions;
  createProcessor: (context: WorkerContext) => Processor;
  registerSchedules?: (queue: Queue) => Promise<void>;
}

export type QueueJob<TData> = Job<TData>;
