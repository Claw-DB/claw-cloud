import { JOB_NAMES, QUEUE_NAMES, TIER_SPECS } from '@claw/common';
import { type QueueJob, type QueueDefinition } from './types.js';

export interface ProvisionJobData {
  instanceId: string;
  workspaceId: string;
  region: string;
  tier: string;
  version: string;
}

export const provisionQueue: QueueDefinition = {
  name: QUEUE_NAMES.PROVISION,
  workerOptions: {
    concurrency: 6,
    limiter: { max: 30, duration: 1000 },
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 7 * 86400, count: 5000 },
  },
  createProcessor: ({ prisma, kube }) => async (job: QueueJob<ProvisionJobData>) => {
    const instance = await prisma.instance.findUnique({ where: { id: job.data.instanceId } });
    if (!instance) {
      return;
    }

    if (job.name === JOB_NAMES.SCALE_INSTANCE) {
      const specs = TIER_SPECS[job.data.tier as keyof typeof TIER_SPECS];
      await kube.scaleInstance(instance, job.data.tier as never);
      await prisma.instance.update({
        where: { id: instance.id },
        data: {
          status: 'RUNNING',
          tier: job.data.tier as never,
          cpuMillicores: specs.cpu,
          memoryMb: specs.mem,
          storageGb: specs.storage,
        },
      });
      return;
    }

    if (job.name === JOB_NAMES.PAUSE_INSTANCE) {
      await kube.pauseInstance(instance);
      await prisma.instance.update({ where: { id: instance.id }, data: { status: 'PAUSED' } });
      return;
    }

    if (job.name === JOB_NAMES.RESUME_INSTANCE) {
      await kube.resumeInstance(instance);
      await prisma.instance.update({ where: { id: instance.id }, data: { status: 'RUNNING' } });
      return;
    }

    if (job.name === JOB_NAMES.TERMINATE_INSTANCE) {
      await kube.terminateInstance(instance);
      await prisma.instance.update({ where: { id: instance.id }, data: { status: 'TERMINATED' } });
      return;
    }

    const { podName, namespace } = await kube.provisionInstance(instance);
    await prisma.instance.update({
      where: { id: instance.id },
      data: {
        status: 'RUNNING',
        podName,
        kubeNamespace: namespace,
      },
    });
    await job.updateProgress(100);
  },
};
